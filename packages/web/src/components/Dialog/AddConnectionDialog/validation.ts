import z from "zod";

// =========================
// VALIDATOR (improved)
// =========================
export const urlOrIpv4Schema = z
  .string()
  .trim()
  .refine((val) => {
    const input = val.replace(/^https?:\/\//i, "");

    const lastColonIndex = input.lastIndexOf(":");
    let host = input;
    let port: number | null = null;

    if (lastColonIndex !== -1) {
      const potentialPort = input.substring(lastColonIndex + 1);
      if (/^\d+$/.test(potentialPort)) {
        host = input.substring(0, lastColonIndex);
        port = parseInt(potentialPort, 10);
      }
    }

    if (port !== null) {
      if (port < 10 || port > 65535) return false;
    }

    // block Windows drive like C:
    if (/^[a-zA-Z]:$/.test(host)) return false;

    const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

    const domainRegex = /^(?!-)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    const localDomainRegex = /^(?!-)(?:[a-zA-Z0-9-]+\.)+local$/;

    return ipv4Regex.test(host) || domainRegex.test(host) || localDomainRegex.test(host);
  }, "Invalid host")
  .transform((val) => {
    return /^https?:\/\//i.test(val) ? val : `http://${val}`;
  });

// =========================
// SAFE LINK DETECTION
// =========================

// include ftp:// as a valid scheme to detect links like ftp://example.com
const safeLinkRegex = /\b((?:https?:\/\/|ftp:\/\/|www\.)[^\s<>]*)/gi;

// optional: plus code detection
const plusCodeRegex = /\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/g;

// block junk like "T:" "Map:" etc
function isClearlyInvalid(token: string) {
  return /^[a-zA-Z]+:$/.test(token);
}

export function extractValidLinks(text: string): string[] {
  const matches = text.match(safeLinkRegex) || [];

  return matches
    .filter((m) => !isClearlyInvalid(m))
    .map((m) => (m.startsWith("www.") ? `http://${m}` : m))
    .filter((url) => {
      try {
        const u = new URL(url);
        // Preserve port when present so port validation in `urlOrIpv4Schema` runs.
        const hostWithPort = u.port ? `${u.hostname}:${u.port}` : u.hostname;
        return urlOrIpv4Schema.safeParse(hostWithPort).success;
      } catch {
        return false;
      }
    });
}

// =========================
// PLUS CODE (optional usage)
// =========================
export function extractPlusCodes(text: string): string[] {
  return text.match(plusCodeRegex) || [];
}
