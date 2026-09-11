const BAN_KEY = "checksplit_wynne_banned";
const BAN_EVENT = "checksplit_wynne_banned";
let bannedThisSession = false;

export function isWynne(name: string | null | undefined): boolean {
  return name?.trim().toLowerCase() === "wynne";
}

export function banWynne(): void {
  bannedThisSession = true;
  try {
    localStorage.setItem(BAN_KEY, "true");
  } catch {
    // Keep the joke working for this session when storage is unavailable.
  }
  window.dispatchEvent(new Event(BAN_EVENT));
}

export function isWynneBanned(): boolean {
  if (bannedThisSession) return true;
  try {
    if (localStorage.getItem(BAN_KEY) === "true") return true;

    // These are this browser's own names, never other check participants.
    return Object.keys(localStorage).some(
      (key) => key.startsWith("checksplit_name_") && isWynne(localStorage.getItem(key))
    );
  } catch {
    return false;
  }
}

export function subscribeToWynneBan(onChange: () => void): () => void {
  window.addEventListener(BAN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BAN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
