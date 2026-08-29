export const DEFAULT_MEDIA_QUOTA_BYTES = 150 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_VIDEO_TYPES = new Set(["video/mp4"]);

export function mediaQuotaBytes(): number {
  const raw = Number(process.env.MEDIA_QUOTA_BYTES);
  if (Number.isFinite(raw) && raw > 0) return Math.trunc(raw);
  return DEFAULT_MEDIA_QUOTA_BYTES;
}

export function kindFromMime(
  mime: string
): "image" | "video" | null {
  if (ALLOWED_IMAGE_TYPES.has(mime)) return "image";
  if (ALLOWED_VIDEO_TYPES.has(mime)) return "video";
  return null;
}

export function maxBytesForKind(kind: "image" | "video"): number {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMediaId(value: string): boolean {
  return UUID_RE.test(value);
}

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "").trim() || "upload";
  return base.slice(0, 255);
}
