"use client";

// Web Push helpers — registers the service worker and manages the
// browser-side PushSubscription. The subscription JSON is stored in
// public.notification_prefs.push_subscriptions by a server action so
// Edge Functions can deliver pushes to all of a user's devices.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getPushPermission():
  | NotificationPermission
  | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export async function subscribeToPush(): Promise<
  { ok: true; subscription: PushSubscriptionJSON } | { ok: false; error: string }
> {
  if (!isPushSupported()) {
    return { ok: false, error: "Push notifications are not supported in this browser." };
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      ok: false,
      error: "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      error:
        permission === "denied"
          ? "Notification permission was denied. Enable it in your browser settings."
          : "Notification permission not granted.",
    };
  }

  const registration =
    (await navigator.serviceWorker.getRegistration("/sw.js")) ??
    (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // TS 5.7+ types Uint8Array as ArrayBufferLike-generic; PushManager
      // wants ArrayBuffer specifically. The runtime call is identical.
      applicationServerKey: urlBase64ToUint8Array(
        VAPID_PUBLIC_KEY,
      ) as unknown as BufferSource,
    }));

  return { ok: true, subscription: subscription.toJSON() };
}

export async function unsubscribeFromPush(): Promise<
  { ok: true; endpoint: string | null } | { ok: false; error: string }
> {
  if (!isPushSupported()) return { ok: true, endpoint: null };
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return { ok: true, endpoint: null };
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: true, endpoint: null };
  const endpoint = subscription.endpoint;
  const ok = await subscription.unsubscribe();
  if (!ok) return { ok: false, error: "Failed to unsubscribe from push." };
  return { ok: true, endpoint };
}
