// /api/create-razorpay-order — called right before opening Razorpay Checkout.
// Creates a Razorpay order for the cart total, and stores the actual cart
// contents server-side (pending_razorpay_orders) keyed by that order id.
// The verify step later reads FROM that stored copy rather than trusting
// whatever the browser sends back after payment — so a tampered request
// can't create an order bigger than what was actually paid for.
//
// CommonJS (module.exports/require) — see notify-order.js for why.
//
// Needs: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (same Supabase vars as notify-order.js).

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const {
    retailer_id, retailer_phone, retailer_name, payment_type,
    coupon_code, discount_amount, subtotal, gst_rate, gst_amount, total,
    notes, items,
  } = req.body || {};

  if (!total || total <= 0 || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Invalid order payload" });
    return;
  }

  try {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

    const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(total * 100), // paise
        currency: "INR",
        notes: { retailer_name: retailer_name || "", retailer_phone: retailer_phone || "" },
      }),
    });

    if (!rpRes.ok) {
      const errText = await rpRes.text().catch(() => "");
      throw new Error(`Razorpay order creation failed: ${rpRes.status} ${errText}`);
    }
    const rpOrder = await rpRes.json();

    // Store the trusted cart details, keyed by the Razorpay order id.
    const storeRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/pending_razorpay_orders`, {
      method: "POST",
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        razorpay_order_id: rpOrder.id,
        retailer_id, retailer_phone, retailer_name, payment_type: payment_type || "RAZORPAY",
        coupon_code, discount_amount, subtotal, gst_rate, gst_amount, total, notes,
        items,
      }),
    });
    if (!storeRes.ok) {
      const errText = await storeRes.text().catch(() => "");
      throw new Error(`Storing pending order failed: ${storeRes.status} ${errText}`);
    }

    res.status(200).json({
      razorpay_order_id: rpOrder.id,
      key_id: process.env.RAZORPAY_KEY_ID, // public, safe to send to the browser
      amount: rpOrder.amount,
      currency: rpOrder.currency,
    });
  } catch (e) {
    console.error("create-razorpay-order error:", e);
    res.status(500).json({ error: "Could not start payment. Please try again." });
  }
};
