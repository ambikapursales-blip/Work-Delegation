import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "7d";

export const generateCommentToken = (taskId, userId) => {
  return jwt.sign(
    { taskId, userId, purpose: "comment_task" },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
};

export const verifyCommentToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
