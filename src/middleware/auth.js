import jwt from "jsonwebtoken";
import User from "../models/User.js";

const USER_CACHE_TTL_MS = 60_000;
const LAST_ACTIVE_INTERVAL_MS = 300_000;

const userCache = new Map();
const lastActiveTracker = new Map();

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (entry && Date.now() - entry.ts < USER_CACHE_TTL_MS) {
    return entry.user;
  }
  return null;
}

function setCachedUser(userId, user) {
  userCache.set(userId, { user, ts: Date.now() });
}

function shouldUpdateLastActive(userId) {
  const last = lastActiveTracker.get(userId);
  const now = Date.now();
  if (!last || now - last > LAST_ACTIVE_INTERVAL_MS) {
    lastActiveTracker.set(userId, now);
    return true;
  }
  return false;
}

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

/**
 * Next.js compatible: extract authenticated user from a NextRequest.
 * Throws or returns the user object.
 */
export async function getAuthUser(request) {
  let token;

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer")) {
    token = authHeader.split(" ")[1];
  } else {
    const cookieToken = request.cookies?.get("token");
    if (cookieToken) {
      token = cookieToken.value;
    }
  }

  if (!token) {
    const error = new Error("Not authorized to access this route");
    error.statusCode = 401;
    throw error;
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const cached = getCachedUser(decoded.id);
  if (cached) {
    if (shouldUpdateLastActive(decoded.id)) {
      User.findByIdAndUpdate(decoded.id, { lastActive: new Date() }).catch(() => {});
    }
    return cached;
  }

  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error("User account is deactivated");
    error.statusCode = 401;
    throw error;
  }

  setCachedUser(decoded.id, user);

  if (shouldUpdateLastActive(decoded.id)) {
    User.findByIdAndUpdate(decoded.id, { lastActive: new Date() }).catch(() => {});
  }

  return user;
}
