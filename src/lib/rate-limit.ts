/**
 * Best-effort in-memory IP rate limiter.
 * Fine for a single Node process; resets on cold start / multi-instance.
 */

type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { _rateLimitBuckets?: Map<string, Bucket> };
const buckets = g._rateLimitBuckets ?? new Map<string, Bucket>();
g._rateLimitBuckets = buckets;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  if (process.env.RATE_LIMIT_DISABLED === "1") {
    return { ok: true, remaining: opts.limit, retryAfterSec: 0 };
  }
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, opts.limit - bucket.count);
  if (bucket.count > opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining, retryAfterSec: 0 };
}

/** Client IP from common proxy headers (best-effort). */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}
