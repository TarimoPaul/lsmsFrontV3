/**
 * Backend 2.4.0 A3 (design MUUNDO-LOGIN-AUDIT.md §4): a random id made once per browser and sent with every login,
 * so the login audit can tell a new device. The server keeps only its sha256. No storage (private mode) → null,
 * and the server falls back to browser + OS + country.
 */
const KEY = 'lsms.device';

export function deviceId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
