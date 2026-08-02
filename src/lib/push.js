// PUSH NOTIFICATION HELPERS (admin only)
// =============================================
import { VAPID_PUBLIC_KEY } from "./config.js";
import { supabaseClient } from "./supabaseClient.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Registers the service worker (idempotent — safe to call every time the
// admin panel loads) and subscribes to push if not already subscribed,
// saving the subscription to Supabase so the server knows where to send
// notifications. Silently does nothing if the browser doesn't support
// push (e.g. some iOS versions, or if the admin hasn't granted permission
// yet) — this should never block or break the admin panel from working.
export async function ensurePushSubscription() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const registration = await navigator.serviceWorker.register("/sw.js");

    const existing = await registration.pushManager.getSubscription();
    if (existing) return; // already subscribed on this device

    if (Notification.permission === "denied") return;
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const json = subscription.toJSON();
    await supabaseClient.from("push_subscriptions").upsert(
      { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      { onConflict: "endpoint" }
    );
  } catch (e) {
    console.warn("Push subscription setup failed (non-fatal):", e);
  }
}
