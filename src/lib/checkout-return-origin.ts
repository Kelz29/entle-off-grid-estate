/**
 * Resolve the public origin for Yoco success/cancel/failure URLs.
 *
 * Prefer the browser's same-origin Origin (matches Host) so production
 * never falls back to a stale APP_BASE_URL=http://localhost:3000.
 * Hosts are still constrained so forged X-Forwarded-Host alone cannot
 * open-redirect (Origin must match Host for the trust path).
 */

function stripSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function addHost(hosts: Set<string>, raw: string | null | undefined) {
  const v = raw?.trim().toLowerCase();
  if (!v) return;
  hosts.add(v);
  const bare = v.split(":")[0] ?? v;
  if (bare) hosts.add(bare);
}

function configuredPublicBase(): string | null {
  const candidates = [
    process.env.NEXT_LIVE_URL,
    process.env.APP_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ];
  for (const c of candidates) {
    if (!c?.trim()) continue;
    const base = stripSlash(c.trim());
    try {
      const u = new URL(base.startsWith("http") ? base : `https://${base}`);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") continue;
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function allowedRedirectHosts(): Set<string> {
  const hosts = new Set<string>();
  addHost(hosts, "localhost");
  addHost(hosts, "127.0.0.1");

  for (const envUrl of [
    process.env.NEXT_LIVE_URL,
    process.env.APP_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ]) {
    if (!envUrl?.trim()) continue;
    try {
      const raw = envUrl.trim();
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      addHost(hosts, u.host);
    } catch {
      addHost(hosts, envUrl);
    }
  }

  for (const part of (process.env.ALLOWED_REDIRECT_HOSTS ?? "").split(",")) {
    addHost(hosts, part);
  }
  return hosts;
}

function hostAllowed(host: string, allowed: Set<string>): boolean {
  const h = host.trim().toLowerCase();
  if (allowed.has(h)) return true;
  const bare = h.split(":")[0] ?? h;
  if (allowed.has(bare)) return true;
  if (bare === "localhost" || bare === "127.0.0.1") return true;
  // Vercel preview / production *.vercel.app
  if (bare.endsWith(".vercel.app")) return true;
  return false;
}

function hostnameOf(hostOrUrl: string): string {
  try {
    if (hostOrUrl.includes("://")) return new URL(hostOrUrl).hostname.toLowerCase();
  } catch {
    /* fall through */
  }
  return hostOrUrl.trim().toLowerCase().split(":")[0] ?? "";
}

function protoFor(host: string, request: Request): string {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return "http";
  return "https";
}

/**
 * Public site origin for this checkout request.
 */
export function checkoutReturnOrigin(request: Request): string {
  const allowed = allowedRedirectHosts();
  const hostHeader =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host")?.trim() ??
    null;
  const originHeader = request.headers.get("origin")?.trim() ?? null;

  // Same-origin browser call: Origin host matches Host → use Origin (correct https + domain).
  if (originHeader && hostHeader) {
    try {
      const originUrl = new URL(originHeader);
      if (hostnameOf(originUrl.host) === hostnameOf(hostHeader)) {
        return stripSlash(originHeader);
      }
    } catch {
      /* ignore */
    }
  }

  // Allowlisted Origin (e.g. configured production domain)
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      if (hostAllowed(originUrl.host, allowed)) {
        return stripSlash(originHeader);
      }
    } catch {
      /* ignore */
    }
  }

  // Allowlisted Host / forwarded host
  if (hostHeader && hostAllowed(hostHeader, allowed)) {
    return `${protoFor(hostHeader, request)}://${hostHeader}`;
  }

  // Public configured base (never localhost when a real URL exists)
  const pub = configuredPublicBase();
  if (pub) return pub;

  const app =
    process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return app;
}
