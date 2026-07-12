import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "7d";

export const generateAcceptToken = (taskId, userId) => {
  return jwt.sign(
    { taskId, userId, purpose: "accept_task" },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
};

export const verifyAcceptToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
