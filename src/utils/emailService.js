import nodemailer from "nodemailer";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const siteButtonHtml = `
  <div style="text-align: center; margin: 25px 0;">
    <a href="${FRONTEND_URL}/tasks" target="_blank" style="
      display: inline-block;
      background: #0F6E56;
      color: #ffffff;
      padding: 12px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      font-size: 15px;
      letter-spacing: 0.5px;
    ">Go to Site</a>
  </div>
`;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.message };
  }
};

export const sendTaskAssignmentEmail = async (userEmail, userName, taskDetails) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0F6E56;">New Task Assigned</h2>
      <p>Hello ${userName},</p>
      <p>You have been assigned a new task:</p>
      <div style="background: #f4f1ec; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">${taskDetails.title}</h3>
        <p style="margin: 0 0 10px 0; color: #666;">${taskDetails.description || "No description"}</p>
        <p style="margin: 0;"><strong>Priority:</strong> ${taskDetails.priority}</p>
        <p style="margin: 0;"><strong>Deadline:</strong> ${taskDetails.deadline ? new Date(taskDetails.deadline).toLocaleDateString() : "No deadline"}</p>
      </div>
      ${siteButtonHtml}
      <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
    </div>
  `;
  return sendEmail(userEmail, "New Task Assigned", html);
};

export const sendTaskCompletionEmail = async (assignerEmail, taskDetails, completedBy) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0F6E56;">Task Completed</h2>
      <p>Hello,</p>
      <p>The following task has been completed by ${completedBy}:</p>
      <div style="background: #f4f1ec; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">${taskDetails.title}</h3>
        <p style="margin: 0 0 10px 0; color: #666;">${taskDetails.description || "No description"}</p>
        <p style="margin: 0;"><strong>Priority:</strong> ${taskDetails.priority}</p>
      </div>
      ${siteButtonHtml}
      <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
    </div>
  `;
  return sendEmail(assignerEmail, "Task Completed", html);
};

export const sendTaskReminderEmail = async (userEmail, userName, taskDetails) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Task Reminder - Deadline Approaching</h2>
      <p>Hello ${userName},</p>
      <p>This is a reminder that your task deadline is approaching:</p>
      <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
        <h3 style="margin: 0 0 10px 0;">${taskDetails.title}</h3>
        <p style="margin: 0 0 10px 0; color: #666;">${taskDetails.description || "No description"}</p>
        <p style="margin: 0;"><strong>Deadline:</strong> ${taskDetails.deadline ? new Date(taskDetails.deadline).toLocaleDateString() : "No deadline"}</p>
      </div>
      ${siteButtonHtml}
      <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
    </div>
  `;
  return sendEmail(userEmail, "Task Reminder", html);
};
