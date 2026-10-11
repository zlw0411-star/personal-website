import { NextResponse, type NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export const config = {
  matcher: ["/life/:path*", "/entries/:path*", "/admin/:path*", "/api/admin/:path*", "/api/entries/:path*", "/api/media/:path*", "/api/life/:path*"],
};
