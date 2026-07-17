const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Brand Colors
const PRIMARY_BLUE = "#0B1F4D";
const SECONDARY_BLUE = "#1A3A75";
const BACKGROUND = "#000000";
const CARD = "#1A1A1A";
const BORDER = "#333333";
const PRIMARY_TEXT = "#FFFFFF";
const SECONDARY_TEXT = "#E0E0E0";
const MUTED = "#A0A0A0";
const SUCCESS = "#16A34A";
const WARNING = "#F59E0B";
const DANGER = "#DC2626";

// Legacy aliases for backward compatibility
const INK = PRIMARY_TEXT;
const PAPER = BACKGROUND;
const RULE = BORDER;
const SUBTLE = MUTED;
const BODY = SECONDARY_TEXT;

const ACCENT = {
  assignment: SECONDARY_BLUE,
  completion: SUCCESS,
  reminder: WARNING,
  security: DANGER,
  event: SECONDARY_BLUE,
};

const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO_STACK = "'SF Mono', 'Courier New', Courier, monospace";

const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td bgcolor="#1E3A8A" style="border: 1px solid #1D4ED8; border-radius: 10px;">
        <a href="${href}" target="_blank" style="
          display: inline-block;
          width: 220px;
          height: 52px;
          line-height: 52px;
          text-align: center;
          font-family: ${FONT_STACK};
          font-size: 15px;
          font-weight: 600;
          color: #FFFFFF;
          text-decoration: none;
        ">${label}</a>
      </td>
    </tr>
  </table>
`;

const detailBlock = (rows) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; margin: 24px 0;">
    ${rows
      .filter(Boolean)
      .map(
        ([label, value], index) => `
      <tr style="background-color: ${index % 2 === 0 ? CARD : BACKGROUND};">
        <td style="padding: 16px 20px; border-bottom: 1px solid ${BORDER}; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${MUTED}; width: 140px; vertical-align: top;">
          ${label}
        </td>
        <td style="padding: 16px 20px; border-bottom: 1px solid ${BORDER}; font-family: ${FONT_STACK}; font-size: 14px; color: ${SECONDARY_TEXT}; vertical-align: top;">
          ${value}
        </td>
      </tr>
    `
      )
      .join("")}
  </table>
`;

const renderEmail = (kind, eyebrow, headline, bodyHtml) => {
  const accent = ACCENT[kind] || PRIMARY_BLUE;
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headline}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${BACKGROUND}; font-family: ${FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BACKGROUND};">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">

            <!-- Header with gradient -->
            <tr>
              <td style="background: linear-gradient(135deg, ${PRIMARY_BLUE} 0%, ${SECONDARY_BLUE} 100%); border-radius: 12px 12px 0 0; padding: 32px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-bottom: 8px;">
                      <span style="font-family: ${FONT_STACK}; font-size: 14px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #FFFFFF;">TaskFlow</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <h1 style="margin: 0; font-family: ${FONT_STACK}; font-size: 28px; font-weight: 700; color: #FFFFFF; line-height: 1.3;">
                        ${headline}
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 8px;">
                      <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 14px; color: rgba(255, 255, 255, 0.85); line-height: 1.5;">
                        ${eyebrow}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Content Card -->
            <tr>
              <td style="background-color: ${CARD}; border-radius: 0 0 12px 12px; border: 1px solid ${BORDER}; border-top: none; padding: 40px 40px 36px 40px;">
                ${bodyHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 32px 16px 0 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${BORDER}; padding-top: 24px;">
                  <tr>
                    <td align="center" style="padding-bottom: 12px;">
                      <span style="font-family: ${FONT_STACK}; font-size: 16px; font-weight: 700; color: ${PRIMARY_TEXT};">TaskFlow</span>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 8px;">
                      <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 13px; color: ${MUTED}; line-height: 1.5;">
                        Professional Task Management Platform
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 12px; color: ${MUTED}; line-height: 1.5;">
                        © ${new Date().getFullYear()} TaskFlow. All rights reserved.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top: 16px;">
                      <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 11px; color: ${MUTED};">
                        This is an automated message from TaskFlow — please don't reply to this email.
                      </p>
                    </td>
                  </tr>
                </table>
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
  <p style="margin: 0 0 16px 0; font-family: ${FONT_STACK}; font-size: 16px; line-height: 1.6; color: ${PRIMARY_TEXT};">Hello ${name},</p>
`;

const lead = (text) => `
  <p style="margin: 0 0 24px 0; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.7; color: ${SECONDARY_TEXT};">${text}</p>
`;

const buttonRow = (btnHtml) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px;">
    <tr><td>${btnHtml}</td></tr>
  </table>
`;

const buttonGrid = (buttons) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${buttons[0] ? `<td style="padding-right: 8px;">${buttons[0]}</td>` : ''}
            ${buttons[1] ? `<td style="padding-left: 8px;">${buttons[1]}</td>` : ''}
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-top: 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${buttons[2] ? `<td style="padding-right: 8px;">${buttons[2]}</td>` : ''}
            ${buttons[3] ? `<td style="padding-left: 8px;">${buttons[3]}</td>` : ''}
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

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
      `<div style="margin-bottom:4px;font-family:${FONT_STACK};font-size:12px;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:1px">Add a comment</div>` +
      ampButton("Submit Comment", ACCENT.event, "text", "Type your comment...", true)
    );
  }

  const actionsSection = actionsHtml ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
      <tr><td style="padding:12px 0;border-top:1px solid ${BORDER};font-family:${FONT_STACK};font-size:13px;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:1px">Quick Actions</td></tr>
      <tr><td>${actionsHtml}</td></tr>
    </table>` : "";

  return `<!doctype html>
<html amp4email>
<head>
  <meta charset="utf-8">
  ${AMP_SCRIPTS}
  <style amp-custom>
    body{margin:0;padding:0;background:${BACKGROUND};font-family:${FONT_STACK}}
    .card{background:${CARD};border-radius:12px;overflow:hidden;border:1px solid ${BORDER}}
    .header{background:linear-gradient(135deg,${PRIMARY_BLUE} 0%,${SECONDARY_BLUE} 100%);border-radius:12px 12px 0 0;padding:32px 40px}
    .header-brand{font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#FFF;padding-bottom:8px}
    .header-title{font-size:28px;font-weight:700;color:#FFF;line-height:1.3;margin:0}
    .header-subtitle{font-size:14px;color:rgba(255,255,255,0.85);line-height:1.5;margin:8px 0 0 0}
    .inner{padding:40px 40px 36px}
    .wordmark{padding-bottom:28px}
    .wordmark span{font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${PRIMARY_TEXT}}
    .eyebrow{margin:0 0 10px;font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${accent}}
    h1{margin:0 0 24px;font-size:24px;font-weight:bold;color:${PRIMARY_TEXT};line-height:1.3}
    p{margin:0 0 20px;font-size:15px;line-height:1.6;color:${SECONDARY_TEXT}}
    .task-card{border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin:24px 0;background:${CARD}}
    .task-card td{padding:24px}
    .badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:bold;letter-spacing:.5px;color:#FFF}
    .desc-label{font-size:13px;font-weight:bold;color:${MUTED};padding-bottom:6px;text-transform:uppercase;letter-spacing:1px}
    .desc-text{font-size:14px;line-height:1.7;color:${SECONDARY_TEXT}}
    .footer{padding:32px 16px 0}
    .footer p{margin:0;font-size:12px;color:${MUTED};line-height:1.5}
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BACKGROUND}">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
        <tr><td class="header">
          <div class="header-brand">TaskFlow</div>
          <h1 class="header-title">${headline}</h1>
          <p class="header-subtitle">${eyebrow}</p>
        </td></tr>
        <tr><td class="card">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="inner">
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

export {
  FRONTEND_URL,
  PRIMARY_BLUE,
  SECONDARY_BLUE,
  BACKGROUND,
  CARD,
  BORDER,
  PRIMARY_TEXT,
  SECONDARY_TEXT,
  MUTED,
  SUCCESS,
  WARNING,
  DANGER,
  INK,
  PAPER,
  RULE,
  SUBTLE,
  BODY,
  ACCENT,
  FONT_STACK,
  MONO_STACK,
  button,
  detailBlock,
  renderEmail,
  greeting,
  lead,
  buttonRow,
  buttonGrid,
  renderAmpEmail,
};
