import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAuthUser } from "@/src/middleware/auth";

/**
 * Build an Express-like `req` object from a NextRequest + route params
 */
export function createReq(request, params = {}) {
  const url = new URL(request.url);
  return {
    user: request.user,
    params,
    query: Object.fromEntries(url.searchParams),
    body: request._body || null,
    headers: Object.fromEntries(request.headers),
    cookies: Object.fromEntries(
      request.cookies?.getAll()?.map((c) => [c.name, c.value]) || [],
    ),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
    method: request.method,
    originalUrl: url.pathname + url.search,
  };
}

/**
 * Create an Express-like `res` object that buffers status/body/cookies
 * and produces a NextResponse via `.toNextResponse()`.
 *
 * Controllers call `res.status(200).json({ success: true, ... })`
 * just like before — this adapter captures it all.
 */
export function createRes() {
  let _status = 200;
  let _body = null;
  let _cookie = null;
  let _headers = {};

  const res = {
    status(code) {
      _status = code;
      return res;
    },
    json(data) {
      _body = data;
    },
    set(key, value) {
      _headers[key] = value;
      return res;
    },
    cookie(name, value, options) {
      _cookie = { name, value, options };
      return res;
    },
    get statusCode() {
      return _status;
    },
    get body() {
      return _body;
    },
    get cookie() {
      return _cookie;
    },
    get headers() {
      return _headers;
    },
  };
  return res;
}

/**
 * Finishes a request by converting the captured response into NextResponse.
 * Call this from every route handler.
 */
export function finishRes(res) {
  const headers = {};
  for (const key of Object.keys(res.headers)) {
    headers[key] = res.headers[key];
  }
  const response = NextResponse.json(res.body, { status: res.statusCode, headers });
  if (res.cookie) {
    response.cookies.set(res.cookie.name, res.cookie.value, res.cookie.options);
  }
  return response;
}

/**
 * Read JSON body once and attach it to request so createReq sees it.
 */
export async function parseBody(request) {
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.headers.get("content-type")?.includes("application/json")
  ) {
    try {
      request._body = await request.json();
    } catch {
      request._body = {};
    }
  } else {
    request._body = {};
  }
}

/**
 * Ensure MongoDB is connected using a global cached promise.
 *
 * Production-grade singleton:
 * - Only one connect call ever in-flight per process
 * - Concurrent requests share the same promise
 * - Hot-reload safe via global.mongoose
 */
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function ensureDbConnection() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        bufferCommands: false,
      })
      .then((mongoose) => {
        cached.conn = mongoose;
        return mongoose;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/**
 * Safely get authenticated user, returning a NextResponse with 401 on failure.
 * On success returns the user object. On failure returns a NextResponse (use instanceof NextResponse to detect).
 *
 * Usage:
 *   const user = await requireAuth(request);
 *   if (user instanceof NextResponse) return user;
 */
export async function requireAuth(request) {
  try {
    return await getAuthUser(request);
  } catch (err) {
    const status = err.statusCode || 401;
    return NextResponse.json(
      { success: false, message: err.message || "Not authorized to access this route" },
      { status },
    );
  }
}
