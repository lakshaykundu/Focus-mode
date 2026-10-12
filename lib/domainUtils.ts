export type DomainResult =
  | { ok: true; domain: string }
  | { ok: false; error: string };

const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Normalize user input into a bare, lowercase hostname suitable for declarativeNetRequest
 * `requestDomains`. Accepts URLs ("https://www.instagram.com/explore"), hosts with ports or
 * paths, and plain domains. A leading `www.` is dropped because `requestDomains` already
 * covers every subdomain of the stored domain.
 */
export function normalizeDomain(input: string): DomainResult {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: 'Enter a domain, e.g. example.com' };
  if (/\s/.test(trimmed)) return { ok: false, error: 'Domains cannot contain spaces' };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
  let hostname: string;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: 'Only web addresses (http/https) can be blocked' };
    }
    hostname = url.hostname;
  } catch {
    return { ok: false, error: 'That does not look like a valid domain' };
  }

  hostname = hostname.replace(/\.+$/, '');
  if (hostname.startsWith('www.')) hostname = hostname.slice(4);

  if (hostname.startsWith('[') || IPV4_RE.test(hostname)) {
    return { ok: false, error: 'IP addresses are not supported; use a domain name' };
  }
  const labels = hostname.split('.');
  if (labels.length < 2) {
    return { ok: false, error: 'Include a top-level domain, e.g. example.com' };
  }
  if (hostname.length > 253 || !labels.every((label) => LABEL_RE.test(label))) {
    return { ok: false, error: 'That does not look like a valid domain' };
  }
  const tld = labels[labels.length - 1] ?? '';
  if (/^\d+$/.test(tld)) {
    return { ok: false, error: 'That does not look like a valid domain' };
  }
  return { ok: true, domain: hostname };
}

/**
 * True when `host` is `domain` or one of its subdomains. Mirrors the semantics of
 * declarativeNetRequest `requestDomains`: `instagram.com` matches `m.instagram.com`
 * but never `fakeinstagram.com`.
 */
export function matchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.+$/, '');
  return h === domain || h.endsWith(`.${domain}`);
}

/** True when `child` is a strict subdomain of `parent`. */
export function isSubdomainOf(child: string, parent: string): boolean {
  return child !== parent && child.endsWith(`.${parent}`);
}

/** Lowercased hostname of an http(s) URL, or null for anything else (chrome://, file:, etc.). */
export function hostnameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Unique domains in first-seen order. */
export function dedupeDomains(domains: Iterable<string>): string[] {
  return [...new Set(domains)];
}
