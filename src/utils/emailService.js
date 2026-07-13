import nodemailer from "nodemailer";
import {
  FRONTEND_URL,
  ACCENT,
  FONT_STACK,
  MONO_STACK,
  INK,
  PAPER,
  CARD,
  RULE,
  SUBTLE,
  BODY,
  button,
  detailBlock,
  renderEmail,
  greeting,
  lead,
  buttonRow,
  renderAmpEmail,
} from "./emailTemplates.js";

/* ------------------------------------------------------------------ */
/*  Transport                                                          */
/* ------------------------------------------------------------------ */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html, amp) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    };
    if (amp) mailOptions.amp = amp;
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[EmailService] Failed to send email:", {
      to,
      subject,
      error: error.message,
      stack: error.stack?.split("\n")?.slice(0, 3)?.join("\n"),
      smtpHost: process.env.SMTP_HOST,
      smtpUser: process.env.SMTP_USER,
    });
    return { success: false, error: error.message };
  }
};

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export const sendTaskAssignmentEmail = async (userEmail, userName, taskDetails) => {
  // Pre-computed presentation values
  const deadline = taskDetails.deadline ? new Date(taskDetails.deadline) : null;
  const formattedDeadline = deadline
    ? deadline.toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        timeZone: "UTC",
      })
    : null;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let remainingDays = null;
  let remainingDaysColor = null;
  if (deadline) {
    const deadlineUTC = Date.UTC(
      deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate()
    );
    const diff = Math.round((deadlineUTC - todayUTC) / 86400000);
    if (diff < 0) {
      remainingDays = `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`;
      remainingDaysColor = ACCENT.security;
    } else if (diff === 0) {
      remainingDays = "Due today";
      remainingDaysColor = ACCENT.reminder;
    } else {
      remainingDays = `${diff} day${diff === 1 ? "" : "s"} remaining`;
      remainingDaysColor = "#1F7A5C";
    }
  }

  const taskUrl = taskDetails.taskId
    ? `${FRONTEND_URL}/tasks/${taskDetails.taskId}`
    : `${FRONTEND_URL}/tasks`;

  const priorityBadgeColor =
    taskDetails.priority === "Critical" ? ACCENT.security :
    taskDetails.priority === "High" ? ACCENT.reminder :
    taskDetails.priority === "Medium" ? ACCENT.assignment :
    "#1F7A5C";

  const body = `
    ${greeting(userName)}
    ${lead("You have been assigned a new task that requires your attention.")}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${RULE}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 24px;">

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="3" style="background-color: ${ACCENT.assignment}; border-radius: 2px; padding: 0;">&nbsp;</td>
              <td style="padding: 0 0 0 16px;">
                <h2 style="margin: 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: bold; color: ${INK}; line-height: 1.4;">
                  ${taskDetails.title}
                </h2>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
            <tr>
              <td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; color: #FFFFFF; background-color: ${priorityBadgeColor};">
                  ${taskDetails.priority}
                </span>
              </td>
              <td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; color: #FFFFFF; background-color: ${ACCENT.assignment};">
                  In Progress
                </span>
              </td>
              ${taskDetails.category ? `
              <td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; color: ${SUBTLE}; background-color: ${PAPER}; border: 1px solid ${RULE};">
                  ${taskDetails.category}
                </span>
              </td>` : ""}
            </tr>
          </table>

          ${formattedDeadline ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
            <tr>
              <td style="font-family: ${FONT_STACK}; font-size: 14px; color: ${BODY};">
                <strong>Deadline:</strong> ${formattedDeadline}
              </td>
              <td align="right">
                <span style="display: inline-block; padding: 3px 10px; border-radius: 10px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: bold; color: #FFFFFF; background-color: ${remainingDaysColor};">
                  ${remainingDays}
                </span>
              </td>
            </tr>
          </table>` : `
          <p style="margin: 16px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${SUBTLE};">No deadline</p>`}

          ${taskDetails.assignedBy ? `
          <p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 13px; color: ${SUBTLE};">
            Assigned by: <strong style="color: ${BODY};">${taskDetails.assignedBy.name}</strong>
          </p>` : ""}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="font-family: ${FONT_STACK}; font-size: 13px; font-weight: bold; color: ${SUBTLE}; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">
          Description
        </td>
      </tr>
      <tr>
        <td style="font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.7; color: ${BODY};">
          ${taskDetails.description || "No description provided"}
        </td>
      </tr>
    </table>

    ${taskDetails.attachments && taskDetails.attachments.length > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="font-family: ${FONT_STACK}; font-size: 13px; font-weight: bold; color: ${SUBTLE}; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">
          Attachments (${taskDetails.attachments.length})
        </td>
      </tr>
      ${taskDetails.attachments.map((att) => `
      <tr>
        <td style="padding: 3px 0; font-family: ${FONT_STACK}; font-size: 13px;">
          ${att.name}
        </td>
      </tr>`).join("")}
    </table>` : ""}

    ${taskDetails.checklist && taskDetails.checklist.length > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="font-family: ${FONT_STACK}; font-size: 13px; font-weight: bold; color: ${SUBTLE}; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">
          Checklist
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0 4px 0; font-family: ${FONT_STACK}; font-size: 12px; color: ${SUBTLE};">
          ${taskDetails.checklist.filter(i => i.completed).length}/${taskDetails.checklist.length} completed
        </td>
      </tr>
      ${taskDetails.checklist.map((item) => `
      <tr>
        <td style="padding: 4px 0; font-family: ${FONT_STACK};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding: 0 8px 0 0; vertical-align: middle;">
                ${item.completed
                  ? `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background-color:#1F7A5C;text-align:center;line-height:14px;font-size:10px;color:#FFF;">&#10003;</span>`
                  : `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid ${RULE};"></span>`}
              </td>
              <td style="padding: 0; vertical-align: middle; font-size: 14px; color: ${item.completed ? SUBTLE : BODY}; ${item.completed ? "text-decoration: line-through;" : ""}">
                ${item.text}
              </td>
            </tr>
          </table>
        </td>
      </tr>`).join("")}
    </table>` : ""}

    ${buttonRow(button(taskUrl, "Open Task", ACCENT.assignment))}
    ${taskDetails.completeToken ? `
    ${buttonRow(button(`${FRONTEND_URL}/api/tasks/complete/${taskDetails.completeToken}`, "Complete Task", ACCENT.completion))}` : ""}
    ${taskDetails.commentToken ? `
    ${buttonRow(button(`${FRONTEND_URL}/api/tasks/comment/${taskDetails.commentToken}`, "Add Comment", ACCENT.event))}` : ""}
    ${taskDetails.extensionToken ? `
    ${buttonRow(button(`${FRONTEND_URL}/api/tasks/extend/${taskDetails.extensionToken}`, "Request Revised Target Date", ACCENT.reminder))}` : ""}

    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${SUBTLE};">
      Please review this task and take appropriate action. If you have any questions, reach out to your manager.
    </p>
    ${taskDetails.taskId && taskDetails.userId ? `
    <img src="${FRONTEND_URL}/api/track/open/${taskDetails.taskId}/${taskDetails.userId}"
      width="1" height="1" alt=""
      style="display:block; width:1px; height:1px; border:0;" />` : ""}
  `;
  const html = renderEmail("assignment", "Task Assigned", "You've been assigned a new task", body);

  const ampBody = `
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:${BODY}">Hello ${userName},</p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:${BODY}">You have been assigned a new task that requires your attention.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#FFF;border:1px solid ${RULE};border-radius:8px">
      <tr><td style="padding:24px">
        <h2 style="margin:0;font-size:18px;font-weight:bold;color:${INK};line-height:1.4">${taskDetails.title}</h2>
        <div style="margin-top:12px">
          <span class="badge" style="background:${priorityBadgeColor}">${taskDetails.priority}</span>
          <span class="badge" style="background:${ACCENT.assignment};margin-left:6px">In Progress</span>
        </div>
        ${formattedDeadline ? `
        <p style="margin:12px 0 0;font-size:14px;color:${BODY}"><strong>Deadline:</strong> ${formattedDeadline} <span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:bold;color:#FFF;background:${remainingDaysColor};margin-left:8px">${remainingDays}</span></p>` : `
        <p style="margin:12px 0 0;font-size:14px;color:${SUBTLE}">No deadline</p>`}
      </td></tr>
    </table>

    <p style="font-size:13px;font-weight:bold;color:${SUBTLE};text-transform:uppercase;letter-spacing:1px;margin:20px 0 6px">Description</p>
    <p style="font-size:14px;line-height:1.7;color:${BODY};margin:0">${taskDetails.description || "No description provided"}</p>

    ${taskDetails.attachments && taskDetails.attachments.length > 0 ? `
    <p style="font-size:13px;font-weight:bold;color:${SUBTLE};text-transform:uppercase;letter-spacing:1px;margin:20px 0 6px">Attachments (${taskDetails.attachments.length})</p>
    ${taskDetails.attachments.map((att) => `<p style="font-size:13px;color:${BODY};margin:2px 0">${att.name}</p>`).join("")}` : ""}

    ${taskDetails.checklist && taskDetails.checklist.length > 0 ? `
    <p style="font-size:13px;font-weight:bold;color:${SUBTLE};text-transform:uppercase;letter-spacing:1px;margin:20px 0 6px">Checklist</p>
    <p style="font-size:12px;color:${SUBTLE};margin:0 0 8px">${taskDetails.checklist.filter(i => i.completed).length}/${taskDetails.checklist.length} completed</p>
    ${taskDetails.checklist.map((item) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:0 8px 0 0;vertical-align:middle">
        <span style="display:inline-block;width:14px;height:14px;border-radius:3px;${item.completed ? 'background:#1F7A5C;text-align:center;line-height:14px;font-size:10px;color:#FFF' : 'border:1px solid '+RULE}">${item.completed ? '&#10003;' : ''}</span>
      </td>
      <td style="padding:0;vertical-align:middle;font-size:14px;color:${item.completed ? SUBTLE : BODY};${item.completed ? 'text-decoration:line-through' : ''}">${item.text}</td>
    </tr></table>`).join("")}` : ""}
  `;
  const ampHtml = renderAmpEmail("Task Assigned", "You've been assigned a new task", ampBody, taskDetails);
  return sendEmail(userEmail, "New Task Assigned: " + taskDetails.title, html, ampHtml);
};

export const sendTaskAssignedConfirmationEmail = async (assignerEmail, assignerName, taskDetails, assigneeNames) => {
  const body = `
    ${greeting(assignerName)}
    ${lead(`You have successfully assigned a task to <strong>${assigneeNames}</strong>.`)}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 17px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SUBTLE};">${taskDetails.description || "No description"}</p>
    ${detailBlock([
      ["Priority", taskDetails.priority],
      ["Deadline", taskDetails.deadline ? new Date(taskDetails.deadline).toLocaleDateString() : "No deadline"],
      ["Assigned To", assigneeNames],
    ])}
    ${buttonRow(button(`${FRONTEND_URL}/tasks/${taskDetails.taskId || ""}`, "View task", ACCENT.assignment))}
  `;
  const html = renderEmail("assignment", "Task Assigned", "Task assignment confirmed", body);
  return sendEmail(assignerEmail, "Task Assigned Successfully", html);
};

export const sendTaskCompletionEmail = async (assignerEmail, taskDetails, completedBy) => {
  const body = `
    ${lead(`The following task has been completed by <strong>${completedBy}</strong>.`)}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 17px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SUBTLE};">${taskDetails.description || "No description"}</p>
    ${detailBlock([["Priority", taskDetails.priority]])}
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "Go to site", ACCENT.completion))}
  `;
  const html = renderEmail("completion", "Task Completed", "One task closed out", body);
  return sendEmail(assignerEmail, "Task Completed", html);
};

export const sendPasswordResetOtp = async (email, userName, otp) => {
  const otpDigits = String(otp)
    .split("")
    .join('<span style="display:inline-block; width: 8px;"></span>');
  const body = `
    ${greeting(userName)}
    ${lead("You requested a password reset. Use the code below to continue — it stays valid for 10 minutes.")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${PAPER}; border: 1px solid ${RULE}; border-radius: 3px;">
      <tr>
        <td align="center" style="padding: 26px;">
          <span style="font-family: ${MONO_STACK}; font-size: 34px; font-weight: bold; letter-spacing: 6px; color: ${INK};">${otpDigits}</span>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
      <tr>
        <td style="border-left: 3px solid ${ACCENT.security}; padding: 4px 0 4px 14px;">
          <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 13px; line-height: 1.6; color: ${BODY};">
            <strong style="color: ${ACCENT.security};">Security note —</strong> if you didn't request this, ignore this email and contact your administrator right away. Never share this code with anyone.
          </p>
        </td>
      </tr>
    </table>
  `;
  const html = renderEmail("security", "Password Reset", "Your one-time code", body);
  return sendEmail(email, "Password Reset OTP", html);
};

export const sendTaskEscalationEmail = async (userEmail, userName, taskDetails, reason) => {
  const body = `
    ${greeting(userName)}
    ${lead(`A task has been escalated to you.`)}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 17px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SUBTLE};">${taskDetails.description || "No description"}</p>
    ${detailBlock([
      ["Priority", "Critical"],
      ["Reason", reason || "No reason provided"],
      ["Deadline", taskDetails.deadline ? new Date(taskDetails.deadline).toLocaleDateString() : "No deadline"],
    ])}
    ${buttonRow(button(`${FRONTEND_URL}/tasks/${taskDetails.taskId || ""}`, "View task", ACCENT.reminder))}
  `;
  const html = renderEmail("reminder", "Task Escalated", "A task has been escalated", body);
  return sendEmail(userEmail, "Task Escalated", html);
};

export const sendTaskStatusUpdateEmail = async (userEmail, userName, taskDetails, status, changedBy) => {
  const body = `
    ${greeting(userName)}
    ${lead(`The status of a task has been updated to <strong>${status}</strong> by ${changedBy}.`)}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 17px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SUBTLE};">${taskDetails.description || "No description"}</p>
    ${detailBlock([
      ["Status", status],
      ["Priority", taskDetails.priority],
      ["Deadline", taskDetails.deadline ? new Date(taskDetails.deadline).toLocaleDateString() : "No deadline"],
    ])}
    ${buttonRow(button(`${FRONTEND_URL}/tasks/${taskDetails.taskId || ""}`, "View task", ACCENT.completion))}
  `;
  const html = renderEmail("completion", "Task Updated", `Task marked as ${status}`, body);
  return sendEmail(userEmail, `Task ${status}`, html);
};

export const sendTaskReminderEmail = async (userEmail, userName, taskDetails) => {
  const deadlineText = taskDetails.deadline 
    ? new Date(taskDetails.deadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : "No deadline";
  
  const body = `
    ${greeting(userName)}
    ${lead("This is a friendly reminder about a task that requires your attention.")}
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${RULE}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px;">
          <h2 style="margin: 0 0 8px 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
          <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${BODY};">${taskDetails.description || "No description provided"}</p>
        </td>
      </tr>
    </table>
    
    ${detailBlock([
      ["Priority", `<span style="font-weight: 600; color: ${taskDetails.priority === 'Critical' ? ACCENT.security : taskDetails.priority === 'High' ? ACCENT.reminder : INK};">${taskDetails.priority}</span>`],
      ["Deadline", deadlineText],
    ])}
    
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "View Task Details", ACCENT.reminder))}
    
    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${SUBTLE};">
      Please ensure you complete this task before the deadline. If you need more time or have questions, contact your manager.
    </p>
  `;
  const html = renderEmail("reminder", "Task Reminder", "Don't forget your upcoming task", body);
  return sendEmail(userEmail, "Reminder: " + taskDetails.title, html);
};

export const sendDailyTaskReminderEmail = async (userEmail, userName, taskDetails) => {
  const deadlineText = taskDetails.deadline 
    ? new Date(taskDetails.deadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : "No deadline";
  
  const body = `
    ${greeting(userName)}
    ${lead("Here's your daily reminder about this upcoming task.")}
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${RULE}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px;">
          <h2 style="margin: 0 0 8px 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
          <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${BODY};">${taskDetails.description || "No description provided"}</p>
        </td>
      </tr>
    </table>
    
    ${detailBlock([
      ["Assigned By", taskDetails.assignedBy || "Unknown"],
      ["Priority", `<span style="font-weight: 600; color: ${taskDetails.priority === 'Critical' ? ACCENT.security : taskDetails.priority === 'High' ? ACCENT.reminder : INK};">${taskDetails.priority}</span>`],
      ["Deadline", deadlineText],
      ["Time Remaining", `<span style="font-weight: 600; color: ${ACCENT.reminder};">${taskDetails.daysRemaining || "Unknown"}</span>`],
    ])}
    
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "View Task Details", ACCENT.reminder))}
    
    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${SUBTLE};">
      Stay on track with your tasks. Complete this before the deadline to avoid any delays.
    </p>
  `;
  const html = renderEmail("reminder", "Daily Reminder", "Your task update", body);
  return sendEmail(userEmail, "Daily Reminder: " + taskDetails.title, html);
};

export const sendTaskDueTodayEmail = async (userEmail, userName, taskDetails) => {
  const body = `
    ${greeting(userName)}
    ${lead("This task is due today and requires your immediate attention.")}
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${ACCENT.reminder}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px;">
          <h2 style="margin: 0 0 8px 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
          <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${BODY};">${taskDetails.description || "No description provided"}</p>
        </td>
      </tr>
    </table>
    
    ${detailBlock([
      ["Assigned By", taskDetails.assignedBy || "Unknown"],
      ["Priority", `<span style="font-weight: 600; color: ${taskDetails.priority === 'Critical' ? ACCENT.security : taskDetails.priority === 'High' ? ACCENT.reminder : INK};">${taskDetails.priority}</span>`],
      ["Deadline", `<span style="font-weight: 600; color: ${ACCENT.reminder};">Due Today</span>`],
    ])}
    
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "Complete Task Now", ACCENT.reminder))}
    
    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${SUBTLE};">
      This task must be completed today. Please prioritize it and ensure timely completion.
    </p>
  `;
  const html = renderEmail("reminder", "Due Today", "Action required today", body);
  return sendEmail(userEmail, "Due Today: " + taskDetails.title, html);
};

export const sendEventInvitationEmail = async (userEmail, userName, eventDetails) => {
  const startDate = new Date(eventDetails.startDate).toLocaleString();
  const endDate = new Date(eventDetails.endDate).toLocaleString();

  const body = `
    ${greeting(userName)}
    ${lead("You've been invited to an event.")}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 17px; font-weight: bold; color: ${INK};">${eventDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SUBTLE};">${eventDetails.description || "No description"}</p>
    ${detailBlock([
      ["Type", eventDetails.type],
      ["Starts", startDate],
      ["Ends", endDate],
      eventDetails.location ? ["Location", eventDetails.location] : null,
      eventDetails.isVirtual && eventDetails.meetingLink
        ? ["Meeting Link", `<a href="${eventDetails.meetingLink}" style="color: ${ACCENT.event};">${eventDetails.meetingLink}</a>`]
        : null,
      ["Priority", eventDetails.priority],
    ])}
    ${buttonRow(button(`${FRONTEND_URL}/events`, "View event", ACCENT.event))}
  `;
  const html = renderEmail("event", "Event Invitation", "You're invited", body);
  return sendEmail(userEmail, "New Event Invitation", html);
};

export const sendOverdueTasksSummaryEmail = async (userEmail, userName, overdueCount) => {
  const body = `
    ${greeting(userName)}
    ${lead(`You currently have <strong>${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}</strong>. Please complete them.`)}
    <p style="margin: 0 0 24px 0; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${BODY};}">
      These tasks have passed their deadline and require your attention. Please review and complete them as soon as possible.
    </p>
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "View your tasks", ACCENT.reminder))}
  `;
  const html = renderEmail("reminder", `${overdueCount} Task${overdueCount > 1 ? 's' : ''} Overdue`, "Action required", body);
  return sendEmail(userEmail, `${overdueCount} Task${overdueCount > 1 ? 's' : ''} Overdue`, html);
};