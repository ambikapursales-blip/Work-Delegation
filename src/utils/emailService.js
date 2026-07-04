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

const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    };
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export const sendTaskAssignmentEmail = async (userEmail, userName, taskDetails) => {
  const body = `
    ${greeting(userName)}
    ${lead("You have been assigned a new task.")}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 17px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SUBTLE};">${taskDetails.description || "No description"}</p>
    ${detailBlock([
      ["Priority", taskDetails.priority],
      ["Deadline", taskDetails.deadline ? new Date(taskDetails.deadline).toLocaleDateString() : "No deadline"],
    ])}
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "Go to site", ACCENT.assignment))}
  `;
  const html = renderEmail("assignment", "Task Assigned", "You've got a new task", body);
  return sendEmail(userEmail, "New Task Assigned", html);
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

export const sendTaskReminderEmail = async (userEmail, userName, taskDetails) => {
  const body = `
    ${greeting(userName)}
    ${lead("A task on your list has a deadline coming up.")}
    <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 17px; font-weight: bold; color: ${INK};">${taskDetails.title}</h2>
    <p style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${SUBTLE};">${taskDetails.description || "No description"}</p>
    ${detailBlock([
      ["Deadline", taskDetails.deadline ? new Date(taskDetails.deadline).toLocaleDateString() : "No deadline"],
    ])}
    ${buttonRow(button(`${FRONTEND_URL}/tasks`, "Go to site", ACCENT.reminder))}
  `;
  const html = renderEmail("reminder", "Deadline Approaching", "Don't lose track of this one", body);
  return sendEmail(userEmail, "Task Reminder", html);
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