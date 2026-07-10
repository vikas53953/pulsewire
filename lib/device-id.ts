/** Client-only anonymous device id for beta usage accounting. */

export const DEVICE_KEY = "pw_device";
export const DEVICE_HEADER = "x-pw-device";

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}
