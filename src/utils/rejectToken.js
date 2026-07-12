import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "7d";

export const generateRejectToken = (taskId, userId) => {
  return jwt.sign(
    { taskId, userId, purpose: "reject_task" },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
};

export const verifyRejectToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
