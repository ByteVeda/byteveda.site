const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

/**
 * First entry of `x-forwarded-for`, if it is actually an address.
 *
 * The column is `inet`, and Postgres rejects anything that is not a valid
 * address — so an odd proxy header would otherwise fail the login it was only
 * meant to annotate. Unparseable means null.
 */
export function clientIp(request: Request): string | null {
  const header = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
  if (!header) return null;

  const candidate = header.split(",")[0]?.trim();
  if (!candidate) return null;

  if (IPV4.test(candidate)) {
    const octets = candidate.split(".").map(Number);
    return octets.every((octet) => octet <= 255) ? candidate : null;
  }
  return candidate.includes(":") && IPV6.test(candidate) ? candidate : null;
}

export function userAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}
