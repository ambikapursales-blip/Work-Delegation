import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "30d";

export const generateExtensionResponseToken = (taskId, requestId, action) => {
  return jwt.sign(
    { taskId, requestId, action, purpose: "extension_response" },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
};

export const verifyExtensionResponseToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
