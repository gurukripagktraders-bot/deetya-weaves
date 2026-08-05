// /api/verify-razorpay-payment — called right after the customer completes
// payment in the Razorpay Checkout popup. Verifies the payment signature
// server-side (never trust a client claiming "payment succeeded" without
// this), then creates the actual order using the TRUSTED cart data stored
// earlier by create-razorpay-order.js — not whatever the client sends here
// — so a tampered request can't sneak in a bigger order than was paid for.
//
// CommonJS — see notify-order.js for why.
//
// Needs: RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Missing payment details" });
    return;
  }

  try {
    // 1. Verify the signature — this is what actually proves the payment
    // is genuine and wasn't forged by someone just POSTing fake IDs here.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      res.status(400).json({ error: "Payment verification failed — signature mismatch." });
      return;
    }

    // 2. Look up the TRUSTED order details stored before payment. If this
    // is missing, either the order id is bogus or it was already used.
    const pendingRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/pending_razorpay_orders?razorpay_order_id=eq.${encodeURIComponent(razorpay_order_id)}&select=*`,
      {
        headers: {
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!pendingRes.ok) throw new Error(`Fetching pending order failed: ${pendingRes.status}`);
    const pendingRows = await pendingRes.json();
    const pending = pendingRows[0];
    if (!pending) {
      res.status(400).json({ error: "No matching pending order found — it may have already been processed." });
      return;
    }

    // 3. Create the real order from the trusted stored data, via the same
    // atomic place_order function COD/BANK_QR orders use.
    const placeRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/place_order`, {
      method: "POST",
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_retailer_id: pending.retailer_id,
        p_retailer_phone: pending.retailer_phone,
        p_retailer_name: pending.retailer_name,
        p_payment_type: "RAZORPAY",
        p_coupon_code: pending.coupon_code,
        p_discount_amount: pending.discount_amount,
        p_subtotal: pending.subtotal,
        p_gst_rate: pending.gst_rate,
        p_gst_amount: pending.gst_amount,
        p_total: pending.total,
        p_notes: pending.notes,
        p_items: pending.items,
        p_razorpay_payment_id: razorpay_payment_id,
      }),
    });

    if (!placeRes.ok) {
      const errText = await placeRes.text().catch(() => "");
      // Payment succeeded but order creation failed (e.g. sold out in the
      // meantime) — this needs a human to sort out, not a silent failure.
      console.error("place_order failed after verified payment:", razorpay_payment_id, errText);
      res.status(500).json({
        error: "Payment was received, but we couldn't create your order automatically. Please contact us with your payment ID: " + razorpay_payment_id,
      });
      return;
    }
    const order = await placeRes.json();

    // 4. Clean up — this pending row has served its purpose.
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/pending_razorpay_orders?razorpay_order_id=eq.${encodeURIComponent(razorpay_order_id)}`, {
      method: "DELETE",
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }).catch(() => {}); // non-fatal if this fails

    res.status(200).json(order);
  } catch (e) {
    console.error("verify-razorpay-payment error:", e);
    res.status(500).json({ error: "Something went wrong verifying your payment. Please contact us before retrying." });
  }
};
