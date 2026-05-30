import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "legalpro_session";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const protectedPath = request.nextUrl.pathname.startsWith("/dashboard");
  const protectedApi = request.nextUrl.pathname.startsWith("/api/documents") || request.nextUrl.pathname.startsWith("/api/reports");

  if ((protectedPath || protectedApi) && !token) {
    if (protectedApi) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "expired");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/documents/:path*", "/api/reports/:path*", "/reports/:path*"],
};
