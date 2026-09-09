/** The public sites, which are the only origins allowed to post in production. */
const PRODUCTION_ORIGINS = [
  "https://byteveda.org",
  "https://www.byteveda.org",
  "https://flexiq.byteveda.org",
  "https://docs.byteveda.org",
];

/**
 * TEMPORARY — ngrok tunnelling for local testing.
 *
 * Only consulted outside production, so a tunnel can never be a permitted
 * origin on the deployed console however this file drifts. Delete the constant
 * and its branch in `isAllowedOrigin` when the tunnel is no longer needed.
 */
const NGROK_HOST = /^https:\/\/[a-z0-9-]+\.(ngrok-free\.(app|dev)|ngrok\.(app|io|dev))$/;

function isLocalhost(origin: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.includes(origin)) return true;

  if (process.env.NODE_ENV === "production") return false;
  return isLocalhost(origin) || NGROK_HOST.test(origin);
}

/** Echoes the origin back when it is allowed, and never `*`. */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin) || !origin) return { vary: "origin" };

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "origin",
  };
}
