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

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Check if the route is a protected dashboard route
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|_next/).*)",
  ],
};
