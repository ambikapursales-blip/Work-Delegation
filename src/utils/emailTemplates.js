const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const INK = "#12161C";
const PAPER = "#F6F4EF";
const CARD = "#FFFFFF";
const RULE = "#E7E3DA";
const SUBTLE = "#6B6558";
const BODY = "#2A2620";

const ACCENT = {
  assignment: "#3C4C9E",
  completion: "#1F7A5C",
  reminder: "#B4611E",
  security: "#A32424",
  event: "#6B3FA0",
};

const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO_STACK = "'SF Mono', 'Courier New', Courier, monospace";

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

            <tr>
              <td style="padding-bottom: 28px;">
                <span style="font-family: ${FONT_STACK}; font-size: 13px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; color: ${INK};">TaskFlow</span>
              </td>
            </tr>

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

export {
  FRONTEND_URL,
  INK,
  PAPER,
  CARD,
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
  renderAmpEmail,
};
