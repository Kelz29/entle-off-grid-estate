/** Allowlist post-login redirects to same-origin /admin paths only. */
const ADMIN_NEXT = /^\/admin(\/|$)/;

export function safeAdminNext(raw: string | null | undefined): string {
  if (!raw) return "/admin";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/admin";
  if (path.includes("://") || path.includes("\\")) return "/admin";
  if (!ADMIN_NEXT.test(path)) return "/admin";
  return path;
}
