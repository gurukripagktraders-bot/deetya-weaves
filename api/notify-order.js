// /api/notify-order — called directly from the database (via pg_net) right
// after an order is successfully created, so notification doesn't depend on
// the customer's browser staying open after checkout. Sends both an email
// (Resend) and a push notification (Web Push) to the admin.
//
// Written as CommonJS (module.exports, require) deliberately — package.json
// has no "type": "module", so Node treats .js files as CommonJS by default,
// and Vercel's Node runtime follows that same rule for files in /api.
//
// Needs these environment variables set in Vercel (Project Settings →
// Environment Variables): RESEND_API_KEY, NOTIFY_TO_EMAIL, ORDER_NOTIFY_SECRET,
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// See the setup notes you were given separately.

const webpush = require("web-push");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify this request genuinely came from your own Supabase project, not
  // a random POST from anyone who finds this URL — this endpoint is public
  // by nature (Vercel functions are reachable on the internet), so the
  // shared secret is what keeps it from being spammed.
  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== process.env.ORDER_NOTIFY_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { order_number, retailer_name, retailer_phone, total, payment_type, items } = req.body || {};

  const results = await Promise.allSettled([
    sendEmail({ order_number, retailer_name, retailer_phone, total, payment_type, items }),
    sendPush({ order_number, retailer_name, total }),
  ]);

  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`notify-order: ${i === 0 ? "email" : "push"} failed:`, r.reason);
  });

  // Always 200 — this is fire-and-forget from the database, and a retry
  // storm from pg_net isn't useful even if delivery partially failed.
  res.status(200).json({ ok: true });
};

async function sendEmail({ order_number, retailer_name, retailer_phone, total, payment_type, items }) {
  const itemsHtml = (items || [])
    .map((i) => `<li>${escapeHtml(i.item_name)} — Qty: ${i.quantity} — ₹${i.price_w}/pc</li>`)
    .join("");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px;">
      <h2 style="margin-bottom: 4px;">New order #${order_number}</h2>
      <p style="color:#555; margin-top:0;">from ${escapeHtml(retailer_name || "a retailer")}${retailer_phone ? ` (${escapeHtml(retailer_phone)})` : ""}</p>
      <p><strong>Total:</strong> ₹${total}<br/>
         <strong>Payment:</strong> ${payment_type === "COD" ? "Cash on delivery" : "Bank / QR"}</p>
      <p><strong>Items:</strong></p>
      <ul>${itemsHtml}</ul>
      <p style="color:#888; font-size: 13px;">Open the Seller Dashboard to confirm and process this order.</p>
    </div>
  `;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM_EMAIL || "onboarding@resend.dev",
      to: process.env.NOTIFY_TO_EMAIL,
      subject: `New order #${order_number} — ₹${total} from ${retailer_name || "a retailer"}`,
      html,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text().catch(() => "");
    throw new Error(`Resend ${emailRes.status}: ${errText}`);
  }
}

async function sendPush({ order_number, retailer_name, total }) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return; // not configured, skip quietly
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  webpush.setVapidDetails(
    "mailto:" + (process.env.NOTIFY_TO_EMAIL || "admin@example.com"),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Service-role key here is intentional and safe — this runs server-side
  // only, never shipped to the browser, and needs to read subscriptions
  // regardless of RLS since this is a trusted backend context.
  const subsRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, {
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!subsRes.ok) throw new Error(`Fetching push subscriptions failed: ${subsRes.status}`);
  const subs = await subsRes.json();

  const payload = JSON.stringify({
    title: `New order #${order_number}`,
    body: `₹${total} from ${retailer_name || "a retailer"}`,
    url: "/?admin",
  });

  await Promise.all(
    subs.map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        .catch(async (err) => {
          // 404/410 means this subscription is dead (browser unsubscribed,
          // device reset, etc.) — clean it up so we stop trying it.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
              method: "DELETE",
              headers: {
                "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
            }).catch(() => {});
          } else {
            console.error("push send failed:", err);
          }
        })
    )
  );
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
