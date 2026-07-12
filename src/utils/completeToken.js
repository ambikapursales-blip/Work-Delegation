import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "7d";

export const generateCompleteToken = (taskId, userId) => {
  return jwt.sign(
    { taskId, userId, purpose: "complete_task" },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
};

export const verifyCompleteToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
