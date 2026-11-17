import { isNative, nativeNotifyNow, requestNativeNotifications } from "./native";

let ctx;

export function getAudioContext() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Short three-note chime, generated so no audio file is needed
export function playChime() {
  try {
    const ac = getAudioContext();
    [660, 880, 1320].forEach((freq, i) => {
      const start = ac.currentTime + i * 0.18;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  } catch {
    // Audio not available
  }
}

export function requestNotificationPermission() {
  if (isNative) return requestNativeNotifications();
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Only notifies while the app is in the background.
// `scheduled`: the Android app already scheduled this one with the OS (timer endings), so skip it there.
export async function notify(title, body, { scheduled = false } = {}) {
  if (!document.hidden) return;
  if (isNative) {
    if (!scheduled) nativeNotifyNow(title, body);
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) return registration.showNotification(title, { body, icon: "/icon.svg", badge: "/icon.svg" });
    new Notification(title, { body, icon: "/icon.svg" });
  } catch {
    // Notifications blocked or unsupported
  }
}
