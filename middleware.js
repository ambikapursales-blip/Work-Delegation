import { NextResponse } from "next/server";

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/tasks",
  "/dwr",
  "/events",
  "/users",
  "/performance",
  "/team",
  "/attendance",
  "/profile",
];

const SUPER_ADMIN_ONLY_ROUTES = ["/users"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const isProtected = DASHBOARD_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get("token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isSuperAdminOnly = SUPER_ADMIN_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  if (isSuperAdminOnly) {
    try {
      const meUrl = new URL("/api/auth/me", request.url);
      const meRes = await fetch(meUrl.toString(), {
        headers: {
          Cookie: `token=${token}`,
          Authorization: `Bearer ${token}`,
        },
      });
      const meData = await meRes.json();
      if (!meData.success || meData.user?.role !== "Super Admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|_next/).*)",
  ],
};
