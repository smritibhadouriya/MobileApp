import { Capacitor } from "@capacitor/core";

// True inside the Android (Capacitor) app, false in a normal browser
export const isNative = Capacitor.isNativePlatform();

// The web build talks to its own origin (Vite proxies /socket.io in dev).
// The Android app runs from local files, so it must be built with VITE_SERVER_URL.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;
export const serverMissing = isNative && !SERVER_URL;

// Base URL for invite links: the server also serves the web app in production
export const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || (isNative ? SERVER_URL : window.location.origin) || "").replace(/\/$/, "");

// Plugins are loaded only inside the app so the website doesn't download them
const plugin = {
  notifications: () => import("@capacitor/local-notifications").then((m) => m.LocalNotifications),
  keepAwake: () => import("@capacitor-community/keep-awake").then((m) => m.KeepAwake),
  statusBar: () => import("@capacitor/status-bar"),
  app: () => import("@capacitor/app").then((m) => m.App),
};

const TIMER_NOTIFICATION_ID = 1001;

export async function requestNativeNotifications() {
  if (!isNative) return;
  try {
    const notifications = await plugin.notifications();
    const { display } = await notifications.checkPermissions();
    if (display !== "granted") await notifications.requestPermissions();
  } catch {
    // Permission dialog unavailable
  }
}

export const TEST_NOTIFICATION_ID = 1002;

// Scheduled with the OS so it fires even if Android pauses the app in the background.
// Re-scheduling the same id replaces the previous one.
export async function scheduleNotificationAt(id, atMs, title, body) {
  if (!isNative) return;
  try {
    const notifications = await plugin.notifications();
    await notifications.cancel({ notifications: [{ id }] });
    if (atMs <= Date.now()) return;
    await notifications.schedule({
      notifications: [{ id, title, body, schedule: { at: new Date(atMs), allowWhileIdle: true } }],
    });
  } catch {
    // Notifications not permitted
  }
}

export async function cancelNotification(id) {
  if (!isNative) return;
  try {
    const notifications = await plugin.notifications();
    await notifications.cancel({ notifications: [{ id }] });
  } catch {
    // Nothing scheduled
  }
}

export const scheduleTimerNotification = (atMs, title, body) => scheduleNotificationAt(TIMER_NOTIFICATION_ID, atMs, title, body);
export const cancelTimerNotification = () => cancelNotification(TIMER_NOTIFICATION_ID);

export async function nativeNotifyNow(title, body) {
  try {
    const notifications = await plugin.notifications();
    await notifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e9), title, body }] });
  } catch {
    // Notifications not permitted
  }
}

// Keep the screen on while a focus session runs
export async function setKeepAwake(on) {
  if (!isNative) return;
  try {
    const keepAwake = await plugin.keepAwake();
    await (on ? keepAwake.keepAwake() : keepAwake.allowSleep());
  } catch {
    // Not supported
  }
}

export async function applyStatusBar(theme) {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await plugin.statusBar();
    // Style.Dark = light icons, for the dark theme
    await StatusBar.setStyle({ style: theme === "light" ? Style.Light : Style.Dark });
    await StatusBar.setBackgroundColor({ color: theme === "light" ? "#f8f3ea" : "#1c1714" });
  } catch {
    // Not supported on this Android version
  }
}

// Android hardware back button; returns a cleanup function
export function onBackButton(handler) {
  if (!isNative) return () => {};
  let handle;
  let removed = false;
  plugin.app().then((app) =>
    app.addListener("backButton", handler).then((h) => {
      handle = h;
      if (removed) h.remove();
    })
  );
  return () => {
    removed = true;
    handle?.remove();
  };
}

export async function minimizeApp() {
  if (!isNative) return;
  const app = await plugin.app();
  app.minimizeApp();
}
