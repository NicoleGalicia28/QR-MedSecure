// Resolve a backend origin so the app works both on this machine and from
// other devices on the same LAN (phone/tablet).
//
// Problem this solves: `.env` usually says `http://localhost:5000`. On a
// phone, `localhost` means the phone itself, so every request fails with
// "Cannot reach the server". When the page is opened through a LAN IP or
// hostname, we swap the configured loopback host for the page's hostname
// and keep the configured port.
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function resolveOrigin(configured, fallbackPort) {
  const { protocol, hostname } = window.location;
  const pageIsLoopback = LOOPBACK.has(hostname);
  const fallback = `${protocol}//${hostname}${fallbackPort ? `:${fallbackPort}` : ""}`;

  if (!configured) return fallback;

  try {
    const url = new URL(configured);
    if (!pageIsLoopback && LOOPBACK.has(url.hostname)) {
      url.hostname = hostname;
    }
    return url.origin;
  } catch {
    return configured;
  }
}
