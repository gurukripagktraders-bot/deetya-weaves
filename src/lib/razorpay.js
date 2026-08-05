// RAZORPAY CHECKOUT SCRIPT LOADER
// =============================================
// Loads Razorpay's checkout.js on demand (only when a customer actually
// picks the "Pay Online" option) rather than on every page load, so it
// never adds weight for customers using COD/Bank-QR.

let loadPromise = null;

export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => { loadPromise = null; reject(new Error("Could not load the payment gateway. Check your connection and try again.")); };
    document.body.appendChild(script);
  });

  return loadPromise;
}
