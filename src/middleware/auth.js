import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Not authorized to access this route",
        });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    if (!user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "User account is deactivated" });
    }

    await User.findByIdAndUpdate(decoded.id, { lastActive: new Date() });

    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Token is invalid or expired" });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

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

  await User.findByIdAndUpdate(decoded.id, { lastActive: new Date() });

  return user;
}
