import { NextResponse } from "next/server";
import { ensureDbConnection } from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import User from "@/src/models/User";
import Notification from "@/src/models/Notification";
import Activity from "@/src/models/Activity";
import { verifyExtensionToken } from "@/src/utils/extensionToken";
import { generateExtensionResponseToken } from "@/src/utils/extensionResponseToken";
import { notifyExtensionRequested } from "@/src/utils/conversationMessages.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

function pageHtml(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
  *,*:before,*:after{box-sizing:border-box}
  body{margin:0;padding:0;background:#F6F4EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#FFF;border-radius:8px;padding:40px;max-width:480px;width:90%;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .bar{height:4px;background:#6B3FA0;border-radius:4px 4px 0 0;margin:-40px -40px 24px}
  h1{font-size:20px;font-weight:bold;color:#12161C;margin:0 0 8px}
  p{font-size:14px;color:#2A2620;line-height:1.6;margin:0 0 20px}
  label{display:block;font-size:13px;font-weight:bold;color:#6B6558;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
  input[type=number]{width:100%;padding:12px;border:1px solid #E7E3DA;border-radius:6px;font-size:14px;font-family:inherit;color:#2A2620;background:#FFF;outline:none;box-sizing:border-box}
  input[type=number]:focus{border-color:#6B3FA0;box-shadow:0 0 0 2px rgba(107,63,160,0.15)}
  textarea{width:100%;padding:12px;border:1px solid #E7E3DA;border-radius:6px;font-size:14px;font-family:inherit;color:#2A2620;background:#FFF;resize:vertical;min-height:100px;outline:none;box-sizing:border-box}
  textarea:focus{border-color:#6B3FA0;box-shadow:0 0 0 2px rgba(107,63,160,0.15)}
  button{width:100%;padding:14px;border:none;border-radius:6px;font-size:14px;font-weight:bold;color:#FFF;background:#6B3FA0;cursor:pointer;margin-top:16px}
  button:hover{opacity:0.9}
</style>
</head>
<body><div class="card"><div class="bar"></div>${bodyContent}</div></body>
</html>`;
}

function resultHtml(message, success) {
  const icon = success
    ? `<svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#1F7A5C" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#A32424" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const color = success ? "#1F7A5C" : "#A32424";
  const title = success ? "Extension Requested" : "Request Failed";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
  body{margin:0;padding:0;background:#F6F4EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#FFF;border-radius:8px;padding:40px;max-width:420px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  h1{font-size:20px;font-weight:bold;color:#12161C;margin:0 0 8px}
  p{font-size:14px;color:#2A2620;line-height:1.6;margin:0}
  .bar{height:4px;background:${color};border-radius:4px 4px 0 0;margin:-40px -40px 24px}
</style>
</head>
<body><div class="card"><div class="bar"></div>${icon}<h1>${title}</h1><p>${message}</p></div></body>
</html>`;
}

export async function GET(request, { params }) {
  const { token } = params;

  try {
    const decoded = verifyExtensionToken(token);
    if (decoded.purpose !== "extension_request") {
      return new NextResponse(resultHtml("Invalid token", false), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { taskId, userId } = decoded;

    await ensureDbConnection();
    const [task, user] = await Promise.all([
      Task.findById(taskId).select("title deadline"),
      User.findById(userId).select("name"),
    ]);

    if (!task) {
      return new NextResponse(resultHtml("Task not found", false), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (!user) {
      return new NextResponse(resultHtml("User not found", false), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const deadlineStr = task.deadline
      ? new Date(task.deadline).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          timeZone: "UTC",
        })
      : "No deadline";

    const bodyContent = `
      <h1>Request Revised Target Date</h1>
      <p style="margin-bottom:4px">Task: <strong>${task.title}</strong></p>
      <p style="font-size:12px;color:#6B6558;margin-bottom:4px">Current deadline: ${deadlineStr}</p>
      <p style="font-size:12px;color:#6B6558;margin-bottom:20px">Requesting as ${user.name}</p>
      <form method="POST" action="/api/tasks/extend/${token}">
        <label for="revisedTargetDate">Revised Target Date</label>
        <input type="date" id="revisedTargetDate" name="revisedTargetDate" required style="width:100%;padding:12px;border:1px solid #E7E3DA;border-radius:6px;font-size:14px;font-family:inherit;color:#2A2620;background:#FFF;outline:none;box-sizing:border-box" />
        <div style="margin-top:16px">
          <label for="reason">Reason (required)</label>
          <textarea id="reason" name="reason" maxlength="1000" required placeholder="Explain why you need more time..."></textarea>
        </div>
        <button type="submit">Submit Request</button>
      </form>
    `;

    return new NextResponse(pageHtml("Request Revised Target Date", bodyContent), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg =
      err.name === "TokenExpiredError"
        ? "This link has expired"
        : "Invalid link";
    return new NextResponse(resultHtml(msg, false), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

export async function POST(request, { params }) {
  const { token } = params;

  try {
    const decoded = verifyExtensionToken(token);
    if (decoded.purpose !== "extension_request") {
      return new NextResponse(resultHtml("Invalid token", false), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { taskId, userId } = decoded;

    const formData = await request.formData();
    const revisedTargetDateStr = formData.get("revisedTargetDate");
    const revisedTargetDate = revisedTargetDateStr ? new Date(revisedTargetDateStr + "T00:00:00Z") : null;
    const reason = (formData.get("reason") || "").trim();

    if (!revisedTargetDate || isNaN(revisedTargetDate.getTime())) {
      return new NextResponse(
        resultHtml("Please enter a valid revised target date", false),
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    if (reason.length > 1000) {
      return new NextResponse(
        resultHtml("Reason is too long (max 1000 characters)", false),
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    await ensureDbConnection();
    const [task, user] = await Promise.all([
      Task.findById(taskId),
      User.findById(userId).select("name email"),
    ]);

    if (!task || !user) {
      return new NextResponse(resultHtml("Task or user not found", false), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const pendingRequest = task.extensionRequests.find(
      (r) => r.user?.toString() === userId && r.status === "pending",
    );
    if (pendingRequest) {
      return new NextResponse(
        resultHtml("You already have a pending extension request for this task", false),
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    const deadlineStr = task.deadline
      ? new Date(task.deadline).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          timeZone: "UTC",
        })
      : "No deadline";
    const revisedDateStr = revisedTargetDate.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "UTC",
    });

    task.extensionRequests.push({
      user: userId,
      revisedTargetDate,
      reason: reason || undefined,
      status: "pending",
      requestedAt: new Date(),
    });
    await task.save();

    const savedRequest = task.extensionRequests[task.extensionRequests.length - 1];
    const requestId = savedRequest._id.toString();

    const approveToken = generateExtensionResponseToken(
      String(task._id), requestId, "approved",
    );
    const rejectToken = generateExtensionResponseToken(
      String(task._id), requestId, "rejected",
    );

    let extMessage = null;
    try {
      extMessage = await notifyExtensionRequested(task._id, userId, user.name, reason, revisedTargetDate);
    } catch (e) {
      console.error("Failed to create extension request system message:", e);
    }

    let extConversation = null;
    if (extMessage) {
      try {
        const Conversation = (await import("@/src/models/Conversation")).default;
        extConversation = await Conversation.findOne({ taskId: task._id }).select("_id").lean();
      } catch (e) {
        console.error("Failed to find conversation:", e);
      }
    }

    await Notification.create({
      recipient: task.assignedBy,
      sender: userId,
      title: "Revised Target Date Requested",
      message: `${user.name} requested a revised target date of ${revisedDateStr} for task "${task.title}"${reason ? `: ${reason}` : ""}`,
      type: "task_updated",
      entityId: task._id,
      entityType: "Task",
      actionUrl: `/dwr?tab=conversations&task=${task._id}${extMessage?._id ? `&message=${extMessage._id}` : ""}`,
      conversationId: extConversation?._id,
      messageId: extMessage?._id,
    });

    await Activity.create({
      user: userId,
      type: "task_updated",
      description: `${user.name} requested a revised target date of ${revisedDateStr} for task "${task.title}"`,
      entityId: task._id,
      entityType: "Task",
    });

    const assigner = await User.findById(task.assignedBy).select("email name");
    if (assigner?.email) {
      const approveUrl = `${FRONTEND_URL}/api/tasks/extend-response/${approveToken}`;
      const rejectUrl = `${FRONTEND_URL}/api/tasks/extend-response/${rejectToken}`;
      try {
        const nodemailer = (await import("nodemailer")).default;
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: assigner.email,
          subject: `Revised Target Date Request: ${task.title}`,
          html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F6F4EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:48px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="background:#FFF;border-radius:4px;padding:40px">
<p style="font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:#6B3FA0;margin:0 0 10px">REVISED TARGET DATE REQUEST</p>
<h1 style="font-size:24px;font-weight:bold;color:#12161C;margin:0 0 24px;line-height:1.3">A revised target date has been requested</h1>
<p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#12161C">${task.title}</p>
<p style="margin:0 0 12px;font-size:15px;color:#2A2620;line-height:1.6">${user.name} has requested a revised target date for this task.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:8px 12px;background:#F6F4EF;font-size:13px;font-weight:bold;color:#6B6558;border:1px solid #E7E3DA;width:40%">Current Deadline</td><td style="padding:8px 12px;font-size:13px;color:#2A2620;border:1px solid #E7E3DA">${deadlineStr}</td></tr>
<tr><td style="padding:8px 12px;background:#F6F4EF;font-size:13px;font-weight:bold;color:#6B6558;border:1px solid #E7E3DA">Requested Revised Target Date</td><td style="padding:8px 12px;font-size:13px;color:#2A2620;border:1px solid #E7E3DA">${revisedDateStr}</td></tr>
${reason ? `<tr><td style="padding:8px 12px;background:#F6F4EF;font-size:13px;font-weight:bold;color:#6B6558;border:1px solid #E7E3DA">Reason</td><td style="padding:8px 12px;font-size:13px;color:#2A2620;border:1px solid #E7E3DA">${reason}</td></tr>` : ""}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
<tr><td style="padding-right:12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#1F7A5C" style="border-radius:3px"><a href="${approveUrl}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#FFF;text-decoration:none">Approve</a></td></tr></table>
</td><td>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#A32424" style="border-radius:3px"><a href="${rejectUrl}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#FFF;text-decoration:none">Reject</a></td></tr></table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 8px 0"><p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#6B6558">This is an automated message from TaskFlow.</p></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        });
      } catch (emailError) {
        console.error("[Extension] Failed to send email to manager:", emailError.message);
      }
    }

    return new NextResponse(
      resultHtml(
        `Request for revised target date <strong>(${revisedDateStr})</strong> has been submitted. The task creator has been notified.`,
        true,
      ),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (err) {
    const msg =
      err.name === "TokenExpiredError"
        ? "This link has expired"
        : "Invalid link";
    return new NextResponse(resultHtml(msg, false), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
