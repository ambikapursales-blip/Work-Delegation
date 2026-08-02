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
  PRIMARY_BLUE,
  SECONDARY_BLUE,
  BACKGROUND,
  BORDER,
  PRIMARY_TEXT,
  SECONDARY_TEXT,
  MUTED,
  SUCCESS,
  WARNING,
  DANGER,
  button,
  detailBlock,
  renderEmail,
  greeting,
  lead,
  buttonRow,
  buttonGrid,
  renderAmpEmail,
} from "./emailTemplates.js";
import { EMAIL_CONFIG } from "../config/email.js";
import { getKolkataDateParts } from "./istTime.js";

/* ------------------------------------------------------------------ */
/*  Structured logger                                                  */
/* ------------------------------------------------------------------ */
const log = (level, event, meta = {}) => {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "EmailService",
    event,
    ...meta,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
};

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
  connectionTimeout: EMAIL_CONFIG.smtp.connectionTimeoutMs,
  greetingTimeout: EMAIL_CONFIG.smtp.greetingTimeoutMs,
  socketTimeout: EMAIL_CONFIG.smtp.timeoutMs,
});

export const sendEmail = async (to, subject, html, amp, meta = {}) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    log("warn", "smtp_not_configured", { to, subject, ...meta });
    return { success: false, error: "SMTP not configured", skipped: true };
  }

  const mailOptions = {
    from: process.env.SMTP_USER,
    to,
    subject,
    html,
    timeout: EMAIL_CONFIG.smtp.timeoutMs,
  };
  if (amp) mailOptions.amp = amp;

  try {
    const info = await transporter.sendMail(mailOptions);
    log("info", "email_sent", {
      to,
      subject,
      messageId: info.messageId,
      ...meta,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    log("error", "email_failed", {
      to,
      subject,
      error: error.message,
      smtpHost: process.env.SMTP_HOST,
      smtpUser: process.env.SMTP_USER,
      ...meta,
    });
    return { success: false, error: error.message };
  }
};

/* ------------------------------------------------------------------ */
/*  Shared email helpers                                               */
/* ------------------------------------------------------------------ */

const remainingTime = (deadline) => {
  if (!deadline) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`;
  }
  if (diffDays === 0) {
    return `Due today`;
  }
  return `${diffDays} day${diffDays === 1 ? "" : "s"} remaining`;
};

const priorityColor = (priority) =>
  priority === "Critical"
    ? DANGER
    : priority === "High"
      ? WARNING
      : priority === "Medium"
        ? SECONDARY_BLUE
        : SUCCESS;

const resolveAssignedTo = (assignedTo, fallback) =>
  assignedTo
    ? Array.isArray(assignedTo)
      ? assignedTo.join(", ")
      : assignedTo
    : fallback;

const formatShortDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: EMAIL_CONFIG.timezone.display,
      })
    : "N/A";

const todayShortDate = () =>
  new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: EMAIL_CONFIG.timezone.display,
  });

const taskUrl = (taskId) =>
  taskId ? `${FRONTEND_URL}/dwr?task=${taskId}` : `${FRONTEND_URL}/dwr`;

const descriptionBlock = (description) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px 24px 12px 24px; font-family: ${FONT_STACK}; font-size: 13px; font-weight: 600; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">
          Description
        </td>
      </tr>
      <tr>
        <td style="padding: 0 24px 24px 24px; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.7; color: ${SECONDARY_TEXT};">
          ${description || "No description provided"}
        </td>
      </tr>
    </table>`;

const actionButtons = (details, openColor) => {
  const buttons = [
    button(taskUrl(details.taskId), "View Task"),
    details.completeToken ? button(`${FRONTEND_URL}/api/tasks/complete/${details.completeToken}`, "Mark Complete") : null,
    details.commentToken ? button(`${FRONTEND_URL}/dwr?task=${details.taskId}`, "Add Comment") : null,
    details.extensionToken ? button(`${FRONTEND_URL}/api/tasks/extend/${details.extensionToken}`, "Request Extension") : null,
  ].filter(Boolean);
  
  return buttonGrid(buttons);
};

const trackingPixel = (details) =>
  details.taskId && details.userId
    ? `<img src="${FRONTEND_URL}/api/track/open/${details.taskId}/${details.userId}" width="1" height="1" alt="" style="display:block; width:1px; height:1px; border:0;" />`
    : "";

const badge = (text, bgColor) => `
              <td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: #FFFFFF; background-color: ${bgColor};">
                  ${text}
                </span>
              </td>`;

const taskCard = (title, accentColor, badgeHtml, deadlineHtml, assignedByHtml) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="4" style="background-color: ${accentColor}; border-radius: 3px; padding: 0;">&nbsp;</td>
              <td style="padding: 0 0 0 16px;">
                <h2 style="margin: 0; font-family: ${FONT_STACK}; font-size: 20px; font-weight: 700; color: ${PRIMARY_TEXT}; line-height: 1.4;">
                  ${title}
                </h2>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
            <tr>
              ${badgeHtml}
            </tr>
          </table>
          ${deadlineHtml}
          ${assignedByHtml}
        </td>
      </tr>
    </table>`;

const deadlineSection = (deadline, remainingTimeHtml) =>
  deadline
    ? `<p style="margin: 16px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT};">Deadline: <strong style="color: #FFFFFF;">${formatLongDate(deadline)}</strong></p>${remainingTimeHtml ? `<p style="margin: 8px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT};"><span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #FFF; background-color: ${remainingTimeHtml.includes("Overdue") ? DANGER : SUCCESS};">${remainingTimeHtml}</span></p>` : ""}`
    : `<p style="margin: 16px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${MUTED};">No deadline</p>`;

const formatLongDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: EMAIL_CONFIG.timezone.display,
      })
    : "No deadline";

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export const sendTaskAssignmentEmail = async (
  userEmail,
  userName,
  taskDetails,
) => {
  // Pre-computed presentation values
  const deadline = taskDetails.deadline ? new Date(taskDetails.deadline) : null;
  const formattedDeadline = deadline
    ? deadline.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: EMAIL_CONFIG.timezone.display,
      })
    : null;

  const nowParts = getKolkataDateParts(new Date());
  const todayIST = Date.UTC(
    nowParts.year,
    nowParts.month - 1,
    nowParts.day,
  );
  let remainingDays = null;
  let remainingDaysColor = null;
  if (deadline) {
    const dlParts = getKolkataDateParts(deadline);
    const deadlineIST = Date.UTC(
      dlParts.year,
      dlParts.month - 1,
      dlParts.day,
    );
    const diff = Math.round((deadlineIST - todayIST) / 86400000);
    if (diff < 0) {
      remainingDays = `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`;
      remainingDaysColor = ACCENT.security;
    } else if (diff === 0) {
      remainingDays = "Due today";
      remainingDaysColor = ACCENT.reminder;
    } else {
      remainingDays = `${diff} day${diff === 1 ? "" : "s"} remaining`;
      remainingDaysColor = SUCCESS;
    }
  }

  const pColor = priorityColor(taskDetails.priority);

  const body = `
    ${greeting(userName)}
    ${lead("You have been assigned a new task that requires your attention.")}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 24px;">

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="4" style="background-color: ${ACCENT.assignment}; border-radius: 3px; padding: 0;">&nbsp;</td>
              <td style="padding: 0 0 0 16px;">
                <h2 style="margin: 0; font-family: ${FONT_STACK}; font-size: 20px; font-weight: 700; color: ${PRIMARY_TEXT}; line-height: 1.4;">
                  ${taskDetails.title}
                </h2>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
            <tr>
              <td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: #FFFFFF; background-color: ${pColor};">
                  ${taskDetails.priority}
                </span>
              </td>
              <td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: #FFFFFF; background-color: ${ACCENT.assignment};">
                  In Progress
                </span>
              </td>
              ${
                taskDetails.category
                  ? `
              <td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: ${MUTED}; background-color: ${BACKGROUND}; border: 1px solid ${BORDER};">
                  ${taskDetails.category}
                </span>
              </td>`
                  : ""
              }
            </tr>
          </table>

          ${
            formattedDeadline
              ? `
          <p style="margin: 16px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT};">
                <strong style="color: #FFFFFF;">Deadline:</strong> ${formattedDeadline}
              </p>
          <p style="margin: 8px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT};">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; color: #FFFFFF; background-color: ${remainingDaysColor};">
                  ${remainingDays}
                </span>
              </p>`
              : `
          <p style="margin: 16px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${MUTED};">No deadline</p>`
          }

          ${
            taskDetails.assignedBy
              ? `
          <p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED};">
            Assigned by: <strong style="color: ${DANGER};">${taskDetails.assignedBy.name}</strong>
          </p>`
              : ""
          }
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px 24px 12px 24px; font-family: ${FONT_STACK}; font-size: 13px; font-weight: 600; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">
          Description
        </td>
      </tr>
      <tr>
        <td style="padding: 0 24px 24px 24px; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.7; color: ${SECONDARY_TEXT};">
          ${taskDetails.description || "No description provided"}
        </td>
      </tr>
    </table>

    ${
      taskDetails.attachments && taskDetails.attachments.length > 0
        ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px 24px 12px 24px; font-family: ${FONT_STACK}; font-size: 13px; font-weight: 600; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">
          Attachments (${taskDetails.attachments.length})
        </td>
      </tr>
      ${taskDetails.attachments
        .map(
          (att) => `
      <tr>
        <td style="padding: 4px 24px; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT};">
          ${att.name}
        </td>
      </tr>`,
        )
        .join("")}
    </table>`
        : ""
    }

    ${
      taskDetails.checklist && taskDetails.checklist.length > 0
        ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px 24px 12px 24px; font-family: ${FONT_STACK}; font-size: 13px; font-weight: 600; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">
          Checklist
        </td>
      </tr>
      <tr>
        <td style="padding: 0 24px 8px 24px; font-family: ${FONT_STACK}; font-size: 12px; color: ${MUTED};">
          ${taskDetails.checklist.filter((i) => i.completed).length}/${taskDetails.checklist.length} completed
        </td>
      </tr>
      ${taskDetails.checklist
        .map(
          (item) => `
      <tr>
        <td style="padding: 4px 24px; font-family: ${FONT_STACK};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding: 0 8px 0 0; vertical-align: middle;">
                ${
                  item.completed
                    ? `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background-color:${SUCCESS};text-align:center;line-height:14px;font-size:10px;color:#FFF;">&#10003;</span>`
                    : `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid ${BORDER};"></span>`
                }
              </td>
              <td style="padding: 0; vertical-align: middle; font-size: 14px; color: ${item.completed ? MUTED : SECONDARY_TEXT}; ${item.completed ? "text-decoration: line-through;" : ""}">
                ${item.text}
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
        )
        .join("")}
    </table>`
        : ""
    }

    ${actionButtons(taskDetails, ACCENT.assignment)}

    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${SUBTLE};">
      Please review this task and take appropriate action. If you have any questions, reach out to your manager.
    </p>
    ${trackingPixel(taskDetails)}
  `;
  const html = renderEmail(
    "assignment",
    "Task Assigned",
    "You've been assigned a new task",
    body,
  );

  const ampBody = `
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:${BODY}">Hello ${userName},</p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:${BODY}">You have been assigned a new task that requires your attention.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#FFF;border:1px solid ${RULE};border-radius:8px">
      <tr><td style="padding:24px">
        <h2 style="margin:0;font-size:18px;font-weight:bold;color:${INK};line-height:1.4">${taskDetails.title}</h2>
        <div style="margin-top:12px">
          <span class="badge" style="background:${pColor}">${taskDetails.priority}</span>
          <span class="badge" style="background:${ACCENT.assignment};margin-left:6px">In Progress</span>
        </div>
        ${
          formattedDeadline
            ? `
        <p style="margin:12px 0 0;font-size:14px;color:${BODY}"><strong style="color:#FFF;">Deadline:</strong> ${formattedDeadline}</p>
        <p style="margin:8px 0 0;font-size:14px;color:${BODY}"><span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:bold;color:#FFF;background:${remainingDaysColor}">${remainingDays}</span></p>`
            : `
        <p style="margin:12px 0 0;font-size:14px;color:${SUBTLE}">No deadline</p>`
        }
      </td></tr>
    </table>

    <p style="font-size:13px;font-weight:bold;color:${SUBTLE};text-transform:uppercase;letter-spacing:1px;margin:20px 0 6px">Description</p>
    <p style="font-size:14px;line-height:1.7;color:${BODY};margin:0">${taskDetails.description || "No description provided"}</p>

    ${
      taskDetails.attachments && taskDetails.attachments.length > 0
        ? `
    <p style="font-size:13px;font-weight:bold;color:${SUBTLE};text-transform:uppercase;letter-spacing:1px;margin:20px 0 6px">Attachments (${taskDetails.attachments.length})</p>
    ${taskDetails.attachments.map((att) => `<p style="font-size:13px;color:${BODY};margin:2px 0">${att.name}</p>`).join("")}`
        : ""
    }

    ${
      taskDetails.checklist && taskDetails.checklist.length > 0
        ? `
    <p style="font-size:13px;font-weight:bold;color:${SUBTLE};text-transform:uppercase;letter-spacing:1px;margin:20px 0 6px">Checklist</p>
    <p style="font-size:12px;color:${SUBTLE};margin:0 0 8px">${taskDetails.checklist.filter((i) => i.completed).length}/${taskDetails.checklist.length} completed</p>
    ${taskDetails.checklist
      .map(
        (item) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:0 8px 0 0;vertical-align:middle">
        <span style="display:inline-block;width:14px;height:14px;border-radius:3px;${item.completed ? "background:#1F7A5C;text-align:center;line-height:14px;font-size:10px;color:#FFF" : "border:1px solid " + RULE}">${item.completed ? "&#10003;" : ""}</span>
      </td>
      <td style="padding:0;vertical-align:middle;font-size:14px;color:${item.completed ? SUBTLE : BODY};${item.completed ? "text-decoration:line-through" : ""}">${item.text}</td>
    </tr></table>`,
      )
      .join("")}`
        : ""
    }
  `;
  const ampHtml = renderAmpEmail(
    "Task Assigned",
    "You've been assigned a new task",
    ampBody,
    taskDetails,
  );
  return sendEmail(
    userEmail,
    "New Task Assigned: " + taskDetails.title,
    html,
    ampHtml,
    {
      event: "task_assignment",
      taskId: taskDetails.taskId ? String(taskDetails.taskId) : undefined,
    },
  );
};

export const sendTaskAssignedConfirmationEmail = async (
  assignerEmail,
  assignerName,
  taskDetails,
  assigneeNames,
) => {
  const body = `
    ${greeting(assignerName)}
    ${lead(`You have successfully assigned a task to <strong>${assigneeNames}</strong>.`)}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: 700; color: ${PRIMARY_TEXT};">${taskDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${MUTED};">${taskDetails.description || "No description"}</p>
    ${detailBlock([
      ["Priority", taskDetails.priority],
      [
        "Deadline",
        taskDetails.deadline
          ? new Date(taskDetails.deadline).toLocaleDateString("en-US", {
              timeZone: EMAIL_CONFIG.timezone.display,
            })
          : "No deadline",
      ],
      ["Assigned To", assigneeNames],
    ])}
    ${buttonRow(button(`${FRONTEND_URL}/dwr?task=${taskDetails.taskId || ""}`, "View Task"))}
  `;
  const html = renderEmail(
    "assignment",
    "Task Assigned",
    "Task assignment confirmed",
    body,
  );
  return sendEmail(assignerEmail, "Task Assigned Successfully", html);
};

export const sendTaskCompletionEmail = async (
  assignerEmail,
  taskDetails,
  completedBy,
) => {
  const body = `
    ${lead(`The following task has been completed by <strong>${completedBy}</strong>.`)}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: 700; color: ${PRIMARY_TEXT};">${taskDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${MUTED};">${taskDetails.description || "No description"}</p>
    ${detailBlock([["Priority", taskDetails.priority]])}
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "View Task"))}
  `;
  const html = renderEmail(
    "completion",
    "Task Completed",
    "One task closed out",
    body,
  );
  return sendEmail(assignerEmail, "Task Completed", html);
};

export const sendPasswordResetOtp = async (email, userName, otp) => {
  const otpDigits = String(otp)
    .split("")
    .join('<span style="display:inline-block; width: 8px;"></span>');
  const body = `
    ${greeting(userName)}
    ${lead("You requested a password reset. Use the code below to continue — it stays valid for 10 minutes.")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BACKGROUND}; border: 1px solid ${BORDER}; border-radius: 12px;">
      <tr>
        <td align="center" style="padding: 32px;">
          <span style="font-family: ${MONO_STACK}; font-size: 36px; font-weight: 700; letter-spacing: 6px; color: ${PRIMARY_TEXT};">${otpDigits}</span>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
      <tr>
        <td style="border-left: 4px solid ${DANGER}; padding: 4px 0 4px 16px;">
          <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SECONDARY_TEXT};">
            <strong style="color: ${DANGER};">Security note —</strong> if you didn't request this, ignore this email and contact your administrator right away. Never share this code with anyone.
          </p>
        </td>
      </tr>
    </table>
  `;
  const html = renderEmail(
    "security",
    "Password Reset",
    "Your one-time code",
    body,
  );
  return sendEmail(email, "Password Reset OTP", html);
};

export const sendTaskEscalationEmail = async (
  userEmail,
  userName,
  taskDetails,
  reason,
) => {
  const rt = remainingTime(taskDetails.deadline);
  const assignedToText = resolveAssignedTo(taskDetails.assignedTo, userName);

  const body = `
    ${greeting(userName)}
    ${lead("A task has been <strong>escalated</strong> to you and requires your immediate attention.")}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background: linear-gradient(135deg, #fff2f2 0%, #ffe0e0 100%); border: 2px solid ${DANGER}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 24px;">
          <h2 style="margin: 0 0 8px 0; font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: ${DANGER};">⚠️ TASK ESCALATED</h2>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="4" style="background-color: ${DANGER}; border-radius: 3px; padding: 0;">&nbsp;</td>
              <td style="padding: 0 0 0 16px;">
                <h2 style="margin: 0; font-family: ${FONT_STACK}; font-size: 20px; font-weight: 700; color: ${PRIMARY_TEXT}; line-height: 1.4;">
                  ${taskDetails.title}
                </h2>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
            <tr>
              ${badge("Critical", DANGER)}
              ${badge("Escalated", DANGER)}
              ${
                taskDetails.taskType
                  ? `<td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: ${MUTED}; background-color: ${BACKGROUND}; border: 1px solid ${BORDER};">
                  ${taskDetails.taskType}
                </span>
              </td>`
                  : ""
              }
            </tr>
          </table>

          ${deadlineSection(taskDetails.deadline, rt)}
        </td>
      </tr>
    </table>

    ${descriptionBlock(taskDetails.description)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; padding: 16px 20px; background-color: #fff3e0; border: 1px solid #ffe0b2; border-radius: 8px;">
      <tr>
        <td style="font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SECONDARY_TEXT};">
          <strong style="color: ${WARNING};">Escalation Reason:</strong> ${reason || "No reason provided"}
        </td>
      </tr>
    </table>

    ${detailBlock([
      ["Status", taskDetails.status || "In Progress"],
      ["Priority", `<span style="font-weight: 600; color: ${DANGER};">Critical</span>`],
      ["Assigned To", assignedToText],
      ["Task Type", taskDetails.taskType || "N/A"],
      ["Created Date", formatShortDate(taskDetails.createdAt)],
      ["Current Reminder Date", todayShortDate()],
    ])}

    ${actionButtons(taskDetails, DANGER)}

    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${MUTED};">
      Please review and take action on this escalated task immediately. If you have questions, contact the person who escalated it.
    </p>
    ${trackingPixel(taskDetails)}
  `;
  const html = renderEmail(
    "security",
    "Task Escalated",
    "A task has been escalated",
    body,
  );
  return sendEmail(userEmail, "Task Escalated: " + taskDetails.title, html);
};

export const sendTaskStatusUpdateEmail = async (
  userEmail,
  userName,
  taskDetails,
  status,
  changedBy,
) => {
  const rt = remainingTime(taskDetails.deadline);
  const assignedToText = resolveAssignedTo(taskDetails.assignedTo, userName);
  const pColor = priorityColor(taskDetails.priority);
  const sColor =
    status === "Completed"
      ? ACCENT.completion
      : status === "Overdue"
        ? ACCENT.security
        : status === "In Progress"
          ? ACCENT.assignment
          : ACCENT.reminder;

  const body = `
    ${greeting(userName)}
    ${lead(`The status of a task has been updated to <strong>${status}</strong> by <strong>${changedBy}</strong>.`)}

    ${taskCard(
      taskDetails.title,
      ACCENT.completion,
      `${badge(taskDetails.priority || "N/A", pColor)}${badge(status, sColor)}${
        taskDetails.taskType
          ? `<td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: ${MUTED}; background-color: ${BACKGROUND}; border: 1px solid ${BORDER};">
                  ${taskDetails.taskType}
                </span>
              </td>`
          : ""
      }`,
      deadlineSection(taskDetails.deadline, rt),
      "",
    )}

    ${descriptionBlock(taskDetails.description)}

    ${detailBlock([
      ["Status", `<span style="font-weight: 600; color: ${sColor};">${status}</span>`],
      ["Assigned To", assignedToText],
      ["Task Type", taskDetails.taskType || "N/A"],
      ["Created Date", formatShortDate(taskDetails.createdAt)],
      ["Current Reminder Date", todayShortDate()],
    ])}

    ${actionButtons(taskDetails, ACCENT.completion)}

    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${MUTED};">
      Please review the updated status and take appropriate action.
    </p>
    ${trackingPixel(taskDetails)}
  `;
  const html = renderEmail(
    "completion",
    "Task Updated",
    `Task marked as ${status}`,
    body,
  );
  return sendEmail(userEmail, `Task ${status}: ${taskDetails.title}`, html);
};

export const sendTaskOverdueAlertEmail = async (
  userEmail,
  userName,
  taskDetails,
) => {
  const deadlineText = formatLongDate(taskDetails.deadline);

  const pendingSinceText = taskDetails.pendingSince
    ? formatLongDate(taskDetails.pendingSince)
    : "Unknown";

  const assignedToText = resolveAssignedTo(taskDetails.assignedTo, userName);

  const daysOverdue = taskDetails.daysOverdue ?? 0;

  const pColor = priorityColor(taskDetails.priority);

  const body = `
    ${greeting(userName)}
    ${lead("This task is now overdue and requires immediate attention.")}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background: linear-gradient(135deg, #fff2f2 0%, #ffe0e0 100%); border: 2px solid ${DANGER}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 24px;">
          <h2 style="margin: 0 0 8px 0; font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: ${DANGER};">🚨 DEADLINE PASSED</h2>
          <p style="margin: 0 0 10px 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: 700; color: #7a1717;">Overdue Alert</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="4" style="background-color: ${DANGER}; border-radius: 3px; padding: 0;">&nbsp;</td>
              <td style="padding: 0 0 0 16px;">
                <h2 style="margin: 0; font-family: ${FONT_STACK}; font-size: 20px; font-weight: 700; color: ${PRIMARY_TEXT}; line-height: 1.4;">
                  ${taskDetails.title}
                </h2>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
            <tr>
              ${badge(taskDetails.priority || "N/A", pColor)}
              ${badge("Overdue", DANGER)}
              ${
                taskDetails.taskType
                  ? `<td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: ${MUTED}; background-color: ${BACKGROUND}; border: 1px solid ${BORDER};">
                  ${taskDetails.taskType}
                </span>
              </td>`
                  : ""
              }
            </tr>
          </table>

          <p style="margin: 16px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT};">
            Deadline: <strong style="color: #FFFFFF;">${deadlineText}</strong>
          </p>
          <p style="margin: 8px 0 0 0; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT};">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #FFF; background-color: ${DANGER};">Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}</span>
          </p>
          ${
            taskDetails.assignedBy
              ? `<p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED};">Assigned by: <strong style="color: ${DANGER};">${taskDetails.assignedBy}</strong></p>`
              : ""
          }
        </td>
      </tr>
    </table>

    ${descriptionBlock(taskDetails.description)}

    ${detailBlock([
      ["Status", taskDetails.status || "Overdue"],
      ["Assigned To", assignedToText],
      ["Task Type", taskDetails.taskType || "N/A"],
      ["Original Deadline", deadlineText],
      [
        "Days Overdue",
        `<span style="font-weight: 600; color: ${DANGER};">${daysOverdue} day${daysOverdue === 1 ? "" : "s"}</span>`,
      ],
      ["Pending Since", pendingSinceText],
      ["Created Date", formatShortDate(taskDetails.createdAt)],
      ["Current Reminder Date", todayShortDate()],
    ])}

    ${actionButtons(taskDetails, DANGER)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; padding: 18px; background-color: #ffe8e8; border: 1px solid #f0c2c2; border-radius: 10px;">
      <tr>
        <td style="font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${DANGER};">
          <strong>This task is overdue — act now to prevent further delays.</strong>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${MUTED};">
      This reminder will continue until the task is completed, cancelled, or deleted.
    </p>
    ${trackingPixel(taskDetails)}
  `;
  const html = renderEmail(
    "security",
    "Task Overdue",
    "Task overdue alert",
    body,
  );
  return sendEmail(userEmail, "🚨 Task Overdue: " + taskDetails.title, html);
};

export const sendTaskReminderEmail = async (
  userEmail,
  userName,
  taskDetails,
) => {
  const deadlineText = formatLongDate(taskDetails.deadline);
  const rt = remainingTime(taskDetails.deadline);
  const assignedToText = resolveAssignedTo(taskDetails.assignedTo, userName);
  const pColor = priorityColor(taskDetails.priority);

  const body = `
    ${greeting(userName)}
    ${lead("This is a friendly reminder about a task that requires your attention.")}

    ${taskCard(
      taskDetails.title,
      ACCENT.reminder,
      `${badge(taskDetails.priority || "N/A", pColor)}${badge(taskDetails.status || "In Progress", ACCENT.reminder)}${
        taskDetails.taskType
          ? `<td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: ${MUTED}; background-color: ${BACKGROUND}; border: 1px solid ${BORDER};">
                  ${taskDetails.taskType}
                </span>
              </td>`
          : ""
      }`,
      deadlineSection(taskDetails.deadline, rt),
      taskDetails.assignedBy
        ? `<p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED};">Assigned by: <strong style="color: ${DANGER};">${taskDetails.assignedBy}</strong></p>`
        : "",
    )}

    ${descriptionBlock(taskDetails.description)}

    ${detailBlock([
      ["Status", taskDetails.status || "In Progress"],
      ["Assigned To", assignedToText],
      ["Task Type", taskDetails.taskType || "N/A"],
      ["Created Date", formatShortDate(taskDetails.createdAt)],
      ["Current Reminder Date", todayShortDate()],
    ])}

    ${actionButtons(taskDetails, ACCENT.reminder)}

    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${MUTED};">
      Please ensure you complete this task before the deadline. If you need more time or have questions, contact your manager.
    </p>
    ${trackingPixel(taskDetails)}
  `;
  const html = renderEmail(
    "reminder",
    "Task Reminder",
    "Don't forget your upcoming task",
    body,
  );
  return sendEmail(userEmail, "Reminder: " + taskDetails.title, html);
};

export const sendTaskDueTodayEmail = async (
  userEmail,
  userName,
  taskDetails,
) => {
  const deadlineText = formatLongDate(taskDetails.deadline);
  const rt = remainingTime(taskDetails.deadline);
  const assignedToText = resolveAssignedTo(taskDetails.assignedTo, userName);
  const pColor = priorityColor(taskDetails.priority);

  const body = `
    ${greeting(userName)}
    ${lead("This task is <strong>due today</strong>. Please ensure it is completed before the end of the day.")}

    ${taskCard(
      taskDetails.title,
      ACCENT.reminder,
      `${badge(taskDetails.priority || "N/A", pColor)}${badge(taskDetails.status || "In Progress", ACCENT.reminder)}${
        taskDetails.taskType
          ? `<td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: ${MUTED}; background-color: ${BACKGROUND}; border: 1px solid ${BORDER};">
                  ${taskDetails.taskType}
                </span>
              </td>`
          : ""
      }`,
      deadlineSection(taskDetails.deadline, rt),
      taskDetails.assignedBy
        ? `<p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED};">Assigned by: <strong style="color: ${DANGER};">${taskDetails.assignedBy}</strong></p>`
        : "",
    )}

    ${descriptionBlock(taskDetails.description)}

    ${detailBlock([
      ["Status", taskDetails.status || "In Progress"],
      ["Assigned To", assignedToText],
      ["Task Type", taskDetails.taskType || "N/A"],
      ["Created Date", formatShortDate(taskDetails.createdAt)],
      ["Current Reminder Date", todayShortDate()],
    ])}

    ${actionButtons(taskDetails, ACCENT.reminder)}

    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${MUTED};">
      This task is due today. Please complete it promptly to avoid it becoming overdue.
    </p>
    ${trackingPixel(taskDetails)}
  `;
  const html = renderEmail(
    "reminder",
    "Task Due Today",
    "Action required — task due today",
    body,
  );
  return sendEmail(userEmail, "Due Today: " + taskDetails.title, html);
};

export const sendDailyTaskReminderEmail = async (
  userEmail,
  userName,
  taskDetails,
) => {
  const deadlineText = formatLongDate(taskDetails.deadline);
  const rt = remainingTime(taskDetails.deadline);
  const assignedToText = resolveAssignedTo(taskDetails.assignedTo, userName);
  const pColor = priorityColor(taskDetails.priority);

  const body = `
    ${greeting(userName)}
    ${lead("Here's your daily reminder about this upcoming task.")}

    ${taskCard(
      taskDetails.title,
      ACCENT.reminder,
      `${badge(taskDetails.priority || "N/A", pColor)}${badge(taskDetails.status || "In Progress", ACCENT.reminder)}${
        taskDetails.taskType
          ? `<td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: ${MUTED}; background-color: ${BACKGROUND}; border: 1px solid ${BORDER};">
                  ${taskDetails.taskType}
                </span>
              </td>`
          : ""
      }`,
      deadlineSection(taskDetails.deadline, rt),
      taskDetails.assignedBy
        ? `<p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED};">Assigned by: <strong style="color: ${DANGER};">${taskDetails.assignedBy}</strong></p>`
        : "",
    )}

    ${descriptionBlock(taskDetails.description)}

    ${detailBlock([
      ["Status", taskDetails.status || "In Progress"],
      ["Assigned To", assignedToText],
      ["Task Type", taskDetails.taskType || "N/A"],
      ["Created Date", formatShortDate(taskDetails.createdAt)],
      ["Current Reminder Date", todayShortDate()],
    ])}

    ${actionButtons(taskDetails, ACCENT.reminder)}

    <p style="margin: 24px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${MUTED};">
      Stay on track with your tasks. Complete this before the deadline to avoid any delays.
    </p>
    ${trackingPixel(taskDetails)}
  `;
  const html = renderEmail(
    "reminder",
    "Daily Reminder",
    "Your task update",
    body,
  );
  return sendEmail(userEmail, "Daily Reminder: " + taskDetails.title, html);
};

export const sendEventInvitationEmail = async (
  userEmail,
  userName,
  eventDetails,
) => {
  const startDate = new Date(eventDetails.startDate).toLocaleString(
    "en-US",
    { timeZone: EMAIL_CONFIG.timezone.display },
  );
  const endDate = new Date(eventDetails.endDate).toLocaleString("en-US", {
    timeZone: EMAIL_CONFIG.timezone.display,
  });

  const body = `
    ${greeting(userName)}
    ${lead("You've been invited to an event.")}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: 700; color: ${PRIMARY_TEXT};">${eventDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${MUTED};">${eventDetails.description || "No description"}</p>
    ${detailBlock([
      ["Type", eventDetails.type],
      ["Starts", startDate],
      ["Ends", endDate],
      eventDetails.location ? ["Location", eventDetails.location] : null,
      eventDetails.isVirtual && eventDetails.meetingLink
        ? [
            "Meeting Link",
            `<a href="${eventDetails.meetingLink}" style="color: ${ACCENT.event};">${eventDetails.meetingLink}</a>`,
          ]
        : null,
      ["Priority", eventDetails.priority],
    ])}
    ${buttonRow(button(`${FRONTEND_URL}/events`, "View Event"))}
  `;
  const html = renderEmail("event", "Event Invitation", "You're invited", body);
  return sendEmail(userEmail, "New Event Invitation", html);
};

export const sendOverdueTasksSummaryEmail = async (
  userEmail,
  userName,
  overdueCount,
) => {
  const body = `
    ${greeting(userName)}
    ${lead(`You currently have <strong>${overdueCount} overdue task${overdueCount > 1 ? "s" : ""}</strong>. Please complete them.`)}
    <p style="margin: 0 0 24px 0; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.7; color: ${SECONDARY_TEXT};">
      These tasks have passed their deadline and require your attention. Please review and complete them as soon as possible.
    </p>
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "View Tasks"))}
  `;
  const html = renderEmail(
    "reminder",
    `${overdueCount} Task${overdueCount > 1 ? "s" : ""} Overdue`,
    "Action required",
    body,
  );
  return sendEmail(
    userEmail,
    `${overdueCount} Task${overdueCount > 1 ? "s" : ""} Overdue`,
    html,
  );
};

/* ------------------------------------------------------------------ */
/*  Recurring Summary Email (shared by daily and weekly)               */
/* ------------------------------------------------------------------ */

const summaryStatBox = (label, value, color, widthPct = 50) => `
  <td style="padding: 8px; width: ${widthPct}%; vertical-align: top;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 10px;">
      <tr>
        <td style="padding: 18px 16px; text-align: center;">
          <div style="font-family: ${FONT_STACK}; font-size: 28px; font-weight: 700; color: ${color}; line-height: 1.1;">${value}</div>
          <div style="font-family: ${FONT_STACK}; font-size: 11px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 6px; font-weight: 600;">${label}</div>
        </td>
      </tr>
    </table>
  </td>`;

const statSection = (title, color, statsHtml) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 0 0;">
    <tr>
      <td style="background-color: ${color}; border-radius: 8px 8px 0 0; padding: 10px 18px;">
        <span style="font-family: ${FONT_STACK}; font-size: 12px; font-weight: 700; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px;">${title}</span>
      </td>
    </tr>
    <tr>
      <td style="background-color: ${CARD}; border: 1px solid ${BORDER}; border-top: none; border-radius: 0 0 8px 8px; padding: 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${statsHtml}
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

const renderSummaryTaskCard = (task) => {
  const rt = remainingTime(task.deadline);
  const pColor = priorityColor(task.priority);
  const isOverdue = rt && rt.includes("Overdue");
  const accent = isOverdue ? DANGER : ACCENT.reminder;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0; background-color: ${CARD}; border: 1px solid ${isOverdue ? DANGER : BORDER}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="4" style="background-color: ${accent}; border-radius: 3px; padding: 0;">&nbsp;</td>
              <td style="padding: 0 0 0 16px;">
                <h2 style="margin: 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: 700; color: ${PRIMARY_TEXT}; line-height: 1.4;">
                  ${task.title}
                </h2>
              </td>
            </tr>
          </table>
          ${deadlineSection(task.deadline, rt)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 12px;">
            <tr>
              ${badge(task.priority || "N/A", pColor)}
              ${isOverdue ? badge("Overdue", DANGER) : badge(task.status || "Active", ACCENT.reminder)}
              ${task.taskType ? `<td style="padding: 0 6px 6px 0;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: ${MUTED}; background-color: ${BACKGROUND}; border: 1px solid ${BORDER};">
                  ${task.taskType}
                </span>
              </td>` : ""}
            </tr>
          </table>
          ${task.assignedBy ? `<p style="margin: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED};">Assigned by: <strong style="color: ${DANGER};">${task.assignedBy}</strong></p>` : ""}
          ${actionButtons(task, isOverdue ? DANGER : ACCENT.reminder)}
        </td>
      </tr>
    </table>`;
};

/**
 * Time-of-day greeting.
 */
const timeGreeting = (name) => {
  const hour = getKolkataDateParts(new Date()).hour;
  let period = "Morning";
  if (hour >= 12 && hour < 17) period = "Afternoon";
  else if (hour >= 17) period = "Evening";
  return `
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 12px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
      Good ${period}
    </p>
    <p style="margin: 0 0 20px 0; font-family: ${FONT_STACK}; font-size: 20px; font-weight: 700; color: ${PRIMARY_TEXT}; line-height: 1.3;">
      ${name}
    </p>`;
};

/**
 * Section header for task card lists — renders only when count > 0.
 */
const taskSectionHeader = (label, count, color) => count > 0 ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 8px 0;">
    <tr>
      <td style="border-bottom: 2px solid ${color}; padding-bottom: 8px;">
        <span style="font-family: ${FONT_STACK}; font-size: 15px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">
          ${label}
        </span>
        <span style="font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED}; margin-left: 8px;">(${count})</span>
      </td>
    </tr>
  </table>` : "";

/**
 * Send recurring summary email — used by both daily and weekly summary crons.
 *
 * @param {Object} options
 * @param {string} options.userEmail
 * @param {string} options.userName
 * @param {"daily"|"weekly"|"management"} options.type
 * @param {Object} options.stats  - { totalActive, overdue, inProgress, assignedInPeriod, completedInPeriod, dailyCompletionRate, lastWeekAssignedInPeriod, lastWeekCompletedInPeriod, lastWeekCompletionRate, weeklyCompletionRate, pendingLastWeek, completionRate, totalEmployees }
 * @param {Array}  options.taskCards - Array of task detail objects (max 20)
 * @param {boolean} options.taskCardsTruncated - Whether more tasks exist beyond the card limit
 * @param {number}  options.totalTasks - Total active tasks (for "+X more" message)
 * @param {Array}  [options.overdueCards] - Categorized overdue tasks
 * @param {Array}  [options.todayCards] - Categorized tasks due today
 * @param {Array}  [options.pendingCards] - Categorized pending tasks
 * @param {Array}  [options.inProgressCards] - Tasks with status "In Progress" (daily path)
 * @param {Array}  [options.employees] - Per-employee performance rows (management path only): { name, email, totalTasks, completed, inProgress, overdue, completionRate }
 */
export const sendRecurringSummaryEmail = async ({
  userEmail,
  userName,
  type,
  stats,
  taskCards,
  taskCardsTruncated,
  totalTasks,
  overdueCards,
  todayCards,
  pendingCards,
  inProgressCards,
  completedCards,
  todayAssignedCards,
  highPriorityCards,
  upcomingCards,
  dueThisWeekCards,
  dueTomorrowCards,
  topDepartments,
  employees,
}) => {
  const isDaily = type === "daily";
  const isManagement = type === "management";

  // ── Subject line ───────────────────────────────────────────────────────
  const totalCardCount = (overdueCards?.length || 0) + (todayCards?.length || 0) + (pendingCards?.length || 0);
  const subject = isDaily
    ? `Daily Task Summary — ${totalCardCount} task${totalCardCount !== 1 ? "s" : ""}`
    : isManagement
      ? `Daily Management Summary — ${stats.totalActive} active task${stats.totalActive !== 1 ? "s" : ""}`
      : `Weekly Task Summary — ${stats.weeklyCompletionRate}% complete`;

  // ── Header lead ────────────────────────────────────────────────────────
  const headerLead = isDaily
    ? `Here is your daily overview of your tasks.`
    : isManagement
      ? `Here is today's company-wide performance across all tasks.`
      : `Here is your weekly overview of recurring tasks.`;

  // ── Task card sections ─────────────────────────────────────────────────
  const overdueSection = overdueCards?.length > 0
    ? taskSectionHeader("Overdue Tasks", overdueCards.length, DANGER) +
      overdueCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const todayTasksSection = todayCards?.length > 0
    ? taskSectionHeader("Today's Tasks", todayCards.length, ACCENT.reminder) +
      todayCards.map(renderSummaryTaskCard).join("\n")
    : "";

  // ── Weekly performance sections (weekly path only) ─────────────────────
  const weeklyPerformanceSection = !isDaily ? statSection(
    "Last Week Performance",
    ACCENT.assignment,
    `${summaryStatBox("Total Tasks", stats.totalActive, ACCENT.assignment, 20)}
     ${summaryStatBox("Completed", stats.lastWeekCompletedInPeriod, SUCCESS, 20)}
     ${summaryStatBox("In Progress", stats.inProgress, ACCENT.reminder, 20)}
     ${summaryStatBox("Overdue", stats.overdue, DANGER, 20)}
     ${summaryStatBox("Completion %", `${stats.weeklyCompletionRate}%`, SUCCESS, 20)}`,
  ) : "";

  const weeklyTodaySection = !isDaily ? statSection(
    "This Week's Work",
    ACCENT.reminder,
    `${summaryStatBox("Due This Week", dueThisWeekCards?.length || 0, DANGER, 25)}
     ${summaryStatBox("Scheduled This Week", stats.assignedInPeriod, ACCENT.assignment, 25)}
     ${summaryStatBox("High Priority", highPriorityCards?.length || 0, WARNING, 25)}
     ${summaryStatBox("Upcoming Deadlines", upcomingCards?.length || 0, ACCENT.reminder, 25)}`,
  ) : "";

  const weeklyCompletedSection = !isDaily && completedCards?.length > 0
    ? taskSectionHeader("Completed Last Week", completedCards.length, SUCCESS) +
      completedCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const weeklyInProgressSection = !isDaily && inProgressCards?.length > 0
    ? taskSectionHeader("In Progress", inProgressCards.length, ACCENT.assignment) +
      inProgressCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const weeklyScheduledSection = !isDaily && todayAssignedCards?.length > 0
    ? taskSectionHeader("Scheduled This Week", todayAssignedCards.length, ACCENT.assignment) +
      todayAssignedCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const weeklyDueSection = !isDaily && dueThisWeekCards?.length > 0
    ? taskSectionHeader("Tasks Due This Week", dueThisWeekCards.length, DANGER) +
      dueThisWeekCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const weeklyHighPrioritySection = !isDaily && highPriorityCards?.length > 0
    ? taskSectionHeader("High Priority Tasks", highPriorityCards.length, WARNING) +
      highPriorityCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const weeklyUpcomingSection = !isDaily && upcomingCards?.length > 0
    ? taskSectionHeader("Upcoming Deadlines", upcomingCards.length, ACCENT.reminder) +
      upcomingCards.map(renderSummaryTaskCard).join("\n")
    : "";

  // Weekly fallback: if no categorized weekly cards exist, render the full
  // active task list (preserves the pre-Phase-4 flat-list behavior).
  const weeklySection1Cards =
    weeklyCompletedSection + overdueSection + weeklyInProgressSection;
  const weeklySection2Cards =
    weeklyDueSection + weeklyScheduledSection + weeklyHighPrioritySection + weeklyUpcomingSection;
  const weeklyCardList =
    weeklySection1Cards + weeklySection2Cards ||
    taskCards.map(renderSummaryTaskCard).join("\n");

  // ── Daily performance sections (daily path only) ───────────────────────
  const dailyPerformanceSection = isDaily ? statSection(
    "Yesterday Performance",
    ACCENT.assignment,
    `${summaryStatBox("Total Tasks", stats.totalActive, ACCENT.assignment, 20)}
     ${summaryStatBox("Completed", stats.completedInPeriod, SUCCESS, 20)}
     ${summaryStatBox("In Progress", stats.inProgress, ACCENT.reminder, 20)}
     ${summaryStatBox("Overdue", stats.overdue, DANGER, 20)}
     ${summaryStatBox("Completion %", `${stats.dailyCompletionRate}%`, SUCCESS, 20)}`,
  ) : "";

  const dailyTodaySection = isDaily ? statSection(
    "Today's Work",
    ACCENT.reminder,
    `${summaryStatBox("Total Tasks", stats.totalActive, ACCENT.assignment, 20)}
     ${summaryStatBox("Due Today", todayCards?.length || 0, DANGER, 20)}
     ${summaryStatBox("Generated Today", stats.assignedInPeriod, ACCENT.assignment, 20)}
     ${summaryStatBox("High Priority", highPriorityCards?.length || 0, WARNING, 20)}
     ${summaryStatBox("Upcoming Deadlines", upcomingCards?.length || 0, ACCENT.reminder, 20)}`,
  ) : "";

  const completedSection = isDaily && completedCards?.length > 0
    ? taskSectionHeader("Completed Yesterday", completedCards.length, SUCCESS) +
      completedCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const inProgressSection = isDaily && inProgressCards?.length > 0
    ? taskSectionHeader("In Progress", inProgressCards.length, ACCENT.assignment) +
      inProgressCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const generatedTodaySection = isDaily && todayAssignedCards?.length > 0
    ? taskSectionHeader("Generated Today", todayAssignedCards.length, ACCENT.assignment) +
      todayAssignedCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const highPrioritySection = isDaily && highPriorityCards?.length > 0
    ? taskSectionHeader("High Priority Tasks", highPriorityCards.length, WARNING) +
      highPriorityCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const upcomingSection = isDaily && upcomingCards?.length > 0
    ? taskSectionHeader("Upcoming Deadlines", upcomingCards.length, ACCENT.reminder) +
      upcomingCards.map(renderSummaryTaskCard).join("\n")
    : "";

  // ── Management sections (management path only) ─────────────────────────
  const managementPerformanceSection = isManagement ? statSection(
    "Today's Company Performance",
    ACCENT.assignment,
    `${summaryStatBox("Total Employees", stats.totalEmployees ?? 0, ACCENT.assignment, 16)}
     ${summaryStatBox("Created Today", stats.assignedInPeriod, ACCENT.assignment, 16)}
     ${summaryStatBox("Completed Today", stats.completedInPeriod, SUCCESS, 16)}
     ${summaryStatBox("Total Pending", stats.totalActive, ACCENT.reminder, 16)}
     ${summaryStatBox("Total Overdue", stats.overdue, DANGER, 16)}
     ${summaryStatBox("Completion %", `${stats.completionRate}%`, SUCCESS, 16)}`,
  ) : "";

  const managementHighlightsSection = isManagement ? statSection(
    "Today's Highlights",
    ACCENT.reminder,
    `${summaryStatBox("High Priority", highPriorityCards?.length || 0, WARNING, 25)}
     ${summaryStatBox("Newly Generated", todayAssignedCards?.length || 0, ACCENT.assignment, 25)}
     ${summaryStatBox("Due Tomorrow", dueTomorrowCards?.length || 0, DANGER, 25)}
     ${summaryStatBox("Top Pending Depts", topDepartments?.length || 0, ACCENT.reminder, 25)}`,
  ) : "";

  const managementHighPrioritySection = isManagement && highPriorityCards?.length > 0
    ? taskSectionHeader("High Priority Tasks", highPriorityCards.length, WARNING) +
      highPriorityCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const managementGeneratedSection = isManagement && todayAssignedCards?.length > 0
    ? taskSectionHeader("Newly Generated Today", todayAssignedCards.length, ACCENT.assignment) +
      todayAssignedCards.map(renderSummaryTaskCard).join("\n")
    : "";

  const managementDueTomorrowSection = isManagement && dueTomorrowCards?.length > 0
    ? taskSectionHeader("Tasks Due Tomorrow", dueTomorrowCards.length, DANGER) +
      dueTomorrowCards.map(renderSummaryTaskCard).join("\n")
    : "";

  // Employee Performance table (management path only) — one row per active
  // employee (excluding Super Admin), built by the builder's perEmployee mode.
  const managementEmployeeTable = isManagement && employees?.length > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 0 0;">
      <tr>
        <td style="background-color: ${ACCENT.assignment}; border-radius: 8px 8px 0 0; padding: 10px 18px;">
          <span style="font-family: ${FONT_STACK}; font-size: 12px; font-weight: 700; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px;">Employee Performance</span>
        </td>
      </tr>
      <tr>
        <td style="background-color: ${CARD}; border: 1px solid ${BORDER}; border-top: none; border-radius: 0 0 8px 8px; padding: 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr style="background-color: ${BACKGROUND};">
              <td style="padding: 12px 16px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.8px;">Employee</td>
              <td align="center" style="padding: 12px 8px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.8px;">Total</td>
              <td align="center" style="padding: 12px 8px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.8px;">Completed</td>
              <td align="center" style="padding: 12px 8px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.8px;">In Progress</td>
              <td align="center" style="padding: 12px 8px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.8px;">Overdue</td>
              <td align="center" style="padding: 12px 16px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.8px;">Completion</td>
            </tr>
            ${employees.map((e) => `
            <tr style="border-top: 1px solid ${BORDER};">
              <td style="padding: 12px 16px; font-family: ${FONT_STACK}; font-size: 14px; font-weight: 600; color: ${PRIMARY_TEXT};">${e.name}</td>
              <td align="center" style="padding: 12px 8px; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT};">${e.totalTasks}</td>
              <td align="center" style="padding: 12px 8px; font-family: ${FONT_STACK}; font-size: 14px; color: ${SUCCESS};">${e.completed}</td>
              <td align="center" style="padding: 12px 8px; font-family: ${FONT_STACK}; font-size: 14px; color: ${ACCENT.reminder};">${e.inProgress}</td>
              <td align="center" style="padding: 12px 8px; font-family: ${FONT_STACK}; font-size: 14px; color: ${DANGER};">${e.overdue}</td>
              <td align="center" style="padding: 12px 16px; font-family: ${FONT_STACK}; font-size: 14px; font-weight: 700; color: ${e.completionRate > 0 ? SUCCESS : MUTED};">${e.completionRate}%</td>
            </tr>`).join("\n")}
          </table>
        </td>
      </tr>
    </table>` : "";

  // Top Pending Departments — omitted gracefully when no department data exists.
  const managementDepartmentsSection = isManagement && topDepartments?.length > 0
    ? taskSectionHeader("Top Pending Departments", topDepartments.length, ACCENT.assignment) +
      topDepartments
        .map(
          (d) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0; background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 18px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family: ${FONT_STACK}; font-size: 16px; font-weight: 700; color: ${PRIMARY_TEXT};">${d.name}</td>
              <td align="right" style="font-family: ${FONT_STACK}; font-size: 15px; font-weight: 700; color: ${ACCENT.reminder};">${d.count} pending</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,
        )
        .join("\n")
    : "";

  // ── Dashboard button ───────────────────────────────────────────────────
  const dashboardButton = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0 16px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="${PRIMARY_BLUE}" style="border-radius: 10px;">
                <a href="${FRONTEND_URL}/tasks" target="_blank" style="display: inline-block; width: 240px; height: 48px; line-height: 48px; text-align: center; font-family: ${FONT_STACK}; font-size: 15px; font-weight: 700; color: #FFFFFF; text-decoration: none; letter-spacing: 0.5px;">
                  Go to Dashboard →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  // ── Truncation note ────────────────────────────────────────────────────
  const truncationHtml = taskCardsTruncated
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 16px 24px; background-color: ${CARD}; border: 1px solid ${BORDER}; border-radius: 8px; text-align: center; font-family: ${FONT_STACK}; font-size: 14px; color: ${MUTED};">
          <strong>+${totalTasks - totalCardCount} more task${totalTasks - totalCardCount !== 1 ? "s" : ""}</strong>
          &nbsp;—&nbsp;
          <a href="${FRONTEND_URL}/tasks" style="color: ${PRIMARY_BLUE}; text-decoration: underline;">View all tasks on Dashboard</a>
        </td>
      </tr>
    </table>`
    : "";

  // ── Build body ─────────────────────────────────────────────────────────
  const body = isDaily ? `
    ${timeGreeting(userName)}
    <p style="margin: 0 0 24px 0; font-family: ${FONT_STACK}; font-size: 16px; line-height: 1.7; color: ${SECONDARY_TEXT};">${headerLead}</p>
    ${dailyTodaySection}
    ${todayTasksSection}
    ${generatedTodaySection}
    ${highPrioritySection}
    ${upcomingSection}
    ${dailyPerformanceSection}
    ${completedSection}
    ${inProgressSection}
    ${overdueSection}
    ${truncationHtml}
    ${dashboardButton}
  ` : isManagement ? `
    ${timeGreeting(userName)}
    <p style="margin: 0 0 24px 0; font-family: ${FONT_STACK}; font-size: 16px; line-height: 1.7; color: ${SECONDARY_TEXT};">${headerLead}</p>
    ${managementPerformanceSection}
    ${managementEmployeeTable}
    ${managementHighlightsSection}
    ${managementHighPrioritySection}
    ${managementGeneratedSection}
    ${managementDueTomorrowSection}
    ${managementDepartmentsSection}
    ${dashboardButton}
  ` : `
    ${timeGreeting(userName)}
    <p style="margin: 0 0 24px 0; font-family: ${FONT_STACK}; font-size: 16px; line-height: 1.7; color: ${SECONDARY_TEXT};">${headerLead}</p>
    ${weeklyPerformanceSection}
    ${weeklySection1Cards}
    ${weeklyTodaySection}
    ${weeklySection2Cards}
    ${truncationHtml}
    ${dashboardButton}
  `;

  const html = renderEmail("reminder", subject, isManagement ? "Daily Management Summary" : "Your task summary", body);
  return sendEmail(userEmail, subject, html);
};
