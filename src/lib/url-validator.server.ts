// Server-only URL validation helper for website research.
//
// Enforces security boundaries before passing a URL to OpenRouter's web_fetch:
// - Valid HTTP or HTTPS scheme only
// - Rejects embedded credentials (username/password)
// - Rejects IPv4 and IPv6 literal addresses
// - Rejects nonstandard ports (only standard 80 / 443 / default allowed)
// - Rejects localhost, single-label hosts, and reserved local TLDs
//
// Does NOT perform any app-side fetch or DNS resolution.

export type ValidatedUrl = {
  ok: true;
  url: string;
  hostname: string;
  normalizedHost: string;
  normalizedDomain: string;
};

export type InvalidUrl = {
  ok: false;
  reason: string;
};

export function validatePublicWebsiteUrl(raw: string): ValidatedUrl | InvalidUrl {
  if (!raw || typeof raw !== "string") {
    return { ok: false, reason: "Website URL is required" };
  }

  let trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "Website URL cannot be empty" };
  }

  // Prepend https:// if protocol is missing
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = "https://" + trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (_e) {
    return { ok: false, reason: "Invalid URL format" };
  }

  // 1. Only HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only HTTP and HTTPS website URLs are supported" };
  }

  // 2. Reject credentials
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Credentials are not permitted in website URLs" };
  }

  // 3. Reject nonstandard ports
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return { ok: false, reason: "Nonstandard network ports are not permitted" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 4. Reject IP address literals (IPv4 / IPv6)
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    return { ok: false, reason: "IP address literals are not permitted" };
  }

  if (hostname.includes(":") || hostname.startsWith("[") || hostname.endsWith("]")) {
    return { ok: false, reason: "IP address literals are not permitted" };
  }

  // 5. Public domain check
  if (
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    return { ok: false, reason: "A public domain name is required" };
  }

  const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
  if (!domainPattern.test(hostname)) {
    return { ok: false, reason: "Invalid domain name syntax" };
  }

  const normalizedHost = hostname;
  const normalizedDomain = hostname.replace(/^www\./, "");

  return {
    ok: true,
    url: parsed.toString(),
    hostname,
    normalizedHost,
    normalizedDomain,
  };
}
