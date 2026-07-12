import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "7d";

export const generateExtensionToken = (taskId, userId) => {
  return jwt.sign(
    { taskId, userId, purpose: "extension_request" },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
};

export const verifyExtensionToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
