import nodemailer from "nodemailer";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/*  A quiet, editorial system: ink on warm paper, with a single        */
/*  color-coded accent bar per email type so the intent is legible     */
/*  at a glance even before reading the subject line.                  */
/* ------------------------------------------------------------------ */
const INK = "#12161C";
const PAPER = "#F6F4EF";
const CARD = "#FFFFFF";
const RULE = "#E7E3DA";
const SUBTLE = "#6B6558";
const BODY = "#2A2620";

const ACCENT = {
  assignment: "#3C4C9E", // indigo — something new has landed
  completion: "#1F7A5C", // green — done, closed out
  reminder: "#B4611E", // amber/rust — attention, time-sensitive
  security: "#A32424", // red — security-critical
  event: "#6B3FA0", // violet — calendar / gathering
};

const FONT_STACK =
  "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO_STACK =
  "'SF Mono', 'Courier New', Courier, monospace";

/* ------------------------------------------------------------------ */
/*  Building blocks                                                    */
/* ------------------------------------------------------------------ */

const button = (href, label, color) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td bgcolor="${color}" style="border-radius: 3px;">
        <a href="${href}" target="_blank" style="
          display: inline-block;
          padding: 13px 30px;
          font-family: ${FONT_STACK};
          font-size: 13px;
          font-weight: bold;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #FFFFFF;
          text-decoration: none;
        ">${label}</a>
      </td>
    </tr>
  </table>
`;

const detailBlock = (rows) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${RULE};">
    ${rows
      .filter(Boolean)
      .map(
        ([label, value]) => `
      <tr>
        <td style="padding: 13px 0; border-bottom: 1px solid ${RULE}; font-family: ${FONT_STACK}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8px; color: ${SUBTLE}; width: 130px; vertical-align: top;">
          ${label}
        </td>
        <td style="padding: 13px 0; border-bottom: 1px solid ${RULE}; font-family: ${FONT_STACK}; font-size: 14px; color: ${BODY}; vertical-align: top;">
          ${value}
        </td>
      </tr>
    `
      )
      .join("")}
  </table>
`;

/**
 * Shell shared by every transactional email.
 * @param {string} kind      - key into ACCENT, drives the identifying color bar
 * @param {string} eyebrow   - small label above the headline (e.g. "TASK ASSIGNED")
 * @param {string} headline  - main heading
 * @param {string} bodyHtml  - message-specific inner content
 */
const renderEmail = (kind, eyebrow, headline, bodyHtml) => {
  const accent = ACCENT[kind] || INK;
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headline}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${PAPER}; font-family: ${FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${PAPER};">
      <tr>
        <td align="center" style="padding: 48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px;">

            <!-- Wordmark -->
            <tr>
              <td style="padding-bottom: 28px;">
                <span style="font-family: ${FONT_STACK}; font-size: 13px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; color: ${INK};">TaskFlow</span>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color: ${CARD}; border-radius: 4px; overflow: hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background-color: ${accent}; height: 4px; line-height: 4px; font-size: 0;">&nbsp;</td></tr>
                  <tr>
                    <td style="padding: 40px 40px 36px 40px;">
                      <p style="margin: 0 0 10px 0; font-family: ${FONT_STACK}; font-size: 11px; font-weight: bold; letter-spacing: 1.6px; text-transform: uppercase; color: ${accent};">
                        ${eyebrow}
                      </p>
                      <h1 style="margin: 0 0 24px 0; font-family: ${FONT_STACK}; font-size: 24px; font-weight: bold; color: ${INK}; line-height: 1.3;">
                        ${headline}
                      </h1>
                      ${bodyHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 8px 0 8px;">
                <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 12px; color: ${SUBTLE};">
                  This is an automated message from TaskFlow — please don't reply to this email.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

const greeting = (name) => `
  <p style="margin: 0 0 20px 0; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${BODY};">Hello ${name},</p>
`;

const lead = (text) => `
  <p style="margin: 0 0 24px 0; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${BODY};">${text}</p>
`;

const buttonRow = (btnHtml) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px;">
    <tr><td>${btnHtml}</td></tr>
  </table>
`;

/* ------------------------------------------------------------------ */
/*  Transport (unchanged)                                              */
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
/*  AMP template                                                       */
/* ------------------------------------------------------------------ */

const AMP_SCRIPTS = `
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <script async custom-element="amp-form" src="https://cdn.ampproject.org/v0/amp-form-0.1.js"></script>
  <script async custom-element="amp-mustache" src="https://cdn.ampproject.org/v0/amp-mustache-0.1.js"></script>
`;

const ampForm = (actionUrl, innerContent) => `
  <form method="post" action-xhr="${actionUrl}" target="_top" style="margin-top:12px">
    ${innerContent}
    <div submit-success style="margin-top:8px">
      <template type="amp-mustache">
        <p style="margin:0;padding:10px 14px;background:#E8F5E9;border-radius:4px;font-family:${FONT_STACK};font-size:14px;color:#1F7A5C;text-align:center;font-weight:bold">{{message}}</p>
      </template>
    </div>
    <div submit-error style="margin-top:8px">
      <template type="amp-mustache">
        <p style="margin:0;padding:10px 14px;background:#FFEBEE;border-radius:4px;font-family:${FONT_STACK};font-size:14px;color:#A32424;text-align:center;font-weight:bold">{{message}}</p>
      </template>
    </div>
  </form>
`;

const ampButton = (label, color, name, placeholder, isTextarea) => `
  <div style="margin-bottom:8px">
    ${isTextarea
      ? `<textarea name="${name}" placeholder="${placeholder}" style="width:100%;padding:10px 12px;border:1px solid ${RULE};border-radius:4px;font-family:${FONT_STACK};font-size:13px;color:${BODY};resize:vertical;min-height:80px;box-sizing:border-box" required></textarea>`
      : `<input type="text" name="${name}" placeholder="${placeholder}" style="width:100%;padding:10px 12px;border:1px solid ${RULE};border-radius:4px;font-family:${FONT_STACK};font-size:13px;color:${BODY};box-sizing:border-box" required>`}
  </div>
  <input type="submit" value="${label}" style="width:100%;padding:12px;border:none;border-radius:4px;font-family:${FONT_STACK};font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#FFF;background:${color};cursor:pointer">
`;

const renderAmpEmail = (eyebrow, headline, bodyHtml, taskDetails) => {
  const accent = ACCENT.assignment;
  const completeUrl = taskDetails?.completeToken ? `${FRONTEND_URL}/api/tasks/complete/${taskDetails.completeToken}?amp=1` : null;
  const commentUrl = taskDetails?.commentToken ? `${FRONTEND_URL}/api/tasks/comment/${taskDetails.commentToken}?amp=1` : null;

  let actionsHtml = "";

  if (completeUrl) {
    actionsHtml += ampForm(completeUrl, ampButton("Complete Task", ACCENT.completion));
  }

  if (commentUrl) {
    actionsHtml += ampForm(commentUrl,
      `<div style="margin-bottom:4px;font-family:${FONT_STACK};font-size:12px;font-weight:bold;color:${SUBTLE};text-transform:uppercase;letter-spacing:1px">Add a comment</div>` +
      ampButton("Submit Comment", ACCENT.event, "text", "Type your comment...", true)
    );
  }

  const actionsSection = actionsHtml ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
      <tr><td style="padding:12px 0;border-top:1px solid ${RULE};font-family:${FONT_STACK};font-size:13px;font-weight:bold;color:${SUBTLE};text-transform:uppercase;letter-spacing:1px">Quick Actions</td></tr>
      <tr><td>${actionsHtml}</td></tr>
    </table>` : "";

  return `<!doctype html>
<html amp4email>
<head>
  <meta charset="utf-8">
  ${AMP_SCRIPTS}
  <style amp-custom>
    body{margin:0;padding:0;background:#F6F4EF;font-family:${FONT_STACK}}
    .card{background:#FFF;border-radius:4px;overflow:hidden}
    .accent{background:${accent};height:4px}
    .inner{padding:40px 40px 36px}
    .wordmark{padding-bottom:28px}
    .wordmark span{font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${INK}}
    .eyebrow{margin:0 0 10px;font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${accent}}
    h1{margin:0 0 24px;font-size:24px;font-weight:bold;color:${INK};line-height:1.3}
    p{margin:0 0 20px;font-size:15px;line-height:1.6;color:${BODY}}
    .task-card{border:1px solid ${RULE};border-radius:8px;overflow:hidden;margin:24px 0;background:${CARD}}
    .task-card td{padding:24px}
    .badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:bold;letter-spacing:.5px;color:#FFF}
    .desc-label{font-size:13px;font-weight:bold;color:${SUBTLE};padding-bottom:6px;text-transform:uppercase;letter-spacing:1px}
    .desc-text{font-size:14px;line-height:1.7;color:${BODY}}
    .footer{padding:24px 8px 0}
    .footer p{margin:0;font-size:12px;color:${SUBTLE};line-height:1.5}
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F4EF">
    <tr><td align="center" style="padding:48px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
        <tr><td class="wordmark"><span>TaskFlow</span></td></tr>
        <tr><td class="card">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="accent"></td></tr>
            <tr><td class="inner">
              <p class="eyebrow">${eyebrow}</p>
              <h1>${headline}</h1>
              ${bodyHtml}
              ${actionsSection}
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="footer"><p>This is an automated message from TaskFlow — please don't reply to this email.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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