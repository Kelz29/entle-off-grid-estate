import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/admin-session";
import { safeAdminNext } from "@/lib/safe-next";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public login screen
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = await verifySessionToken(token);
    if (session) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Protect everything else under /admin
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = await verifySessionToken(token);
    if (!session) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", safeAdminNext(pathname));
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
