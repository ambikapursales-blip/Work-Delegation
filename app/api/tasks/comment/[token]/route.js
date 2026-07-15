import { NextResponse } from "next/server";
import { ensureDbConnection } from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import User from "@/src/models/User";
import Notification from "@/src/models/Notification";
import Activity from "@/src/models/Activity";
import { verifyCommentToken } from "@/src/utils/commentToken";
import { ampCorsHeaders, ampJsonResponse } from "@/src/utils/amp";
import { pauseReminderStateEntry } from "@/src/utils/reminderEngine";

async function getAuthFromToken(token) {
  const decoded = verifyCommentToken(token);
  if (decoded.purpose !== "comment_task") throw new Error("Invalid token");
  return decoded;
}

function pageHtml(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
  *,*:before,*:after{box-sizing:border-box}
  body{margin:0;padding:0;background:#F6F4EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#FFF;border-radius:8px;padding:40px;max-width:480px;width:90%;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .bar{height:4px;background:#3C4C9E;border-radius:4px 4px 0 0;margin:-40px -40px 24px}
  h1{font-size:20px;font-weight:bold;color:#12161C;margin:0 0 8px}
  p{font-size:14px;color:#2A2620;line-height:1.6;margin:0 0 20px}
  label{display:block;font-size:13px;font-weight:bold;color:#6B6558;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
  textarea{width:100%;padding:12px;border:1px solid #E7E3DA;border-radius:6px;font-size:14px;font-family:inherit;color:#2A2620;background:#FFF;resize:vertical;min-height:120px;outline:none}
  textarea:focus{border-color:#3C4C9E;box-shadow:0 0 0 2px rgba(60,76,158,0.15)}
  button{width:100%;padding:14px;border:none;border-radius:6px;font-size:14px;font-weight:bold;color:#FFF;background:#3C4C9E;cursor:pointer;margin-top:16px}
  button:hover{opacity:0.9}
  .success{color:#1F7A5C;font-weight:bold}
  .error{color:#A32424;font-weight:bold}
</style>
</head>
<body><div class="card"><div class="bar"></div>${bodyContent}</div></body>
</html>`;
}

export async function GET(request, { params }) {
  const { token } = params;

  try {
    const decoded = await getAuthFromToken(token);
    const { taskId, userId } = decoded;

    await ensureDbConnection();
    const [task, user] = await Promise.all([
      Task.findById(taskId).select("title"),
      User.findById(userId).select("name"),
    ]);

    if (!task)
      return new NextResponse(
        pageHtml("Error", "<h1>Error</h1><p>Task not found.</p>"),
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    if (!user)
      return new NextResponse(
        pageHtml("Error", "<h1>Error</h1><p>User not found.</p>"),
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );

    const bodyContent = `
      <h1>Add Comment</h1>
      <p style="margin-bottom:4px">Task: <strong>${task.title}</strong></p>
      <p style="font-size:12px;color:#6B6558;margin-bottom:20px">Commenting as ${user.name}</p>
      <form method="POST" action="/api/tasks/comment/${token}">
        <label for="text">Your Comment</label>
        <textarea id="text" name="text" maxlength="1000" required placeholder="Type your comment here..."></textarea>
        <button type="submit">Submit Comment</button>
      </form>
    `;

    return new NextResponse(pageHtml("Add Comment", bodyContent), {
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
    return new NextResponse(pageHtml("Error", `<h1>Error</h1><p>${msg}.</p>`), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

export async function POST(request, { params }) {
  const { token } = params;
  const isAmp = request.nextUrl.searchParams.get("amp") === "1";

  const ampFail = (msg) =>
    isAmp
      ? ampJsonResponse({ success: false, message: msg }, { status: 400 })
      : new NextResponse(pageHtml("Error", `<h1>Error</h1><p>${msg}</p>`), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });

  const ampOk = (msg) =>
    isAmp
      ? ampJsonResponse({ success: true, message: msg })
      : new NextResponse(
          pageHtml(
            "Comment Submitted",
            `
      <div style="text-align:center">
        <svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#1F7A5C" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h1>Comment Submitted</h1>
        <p>${msg}</p>
      </div>
    `,
          ),
          {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store, no-cache, must-revalidate",
            },
          },
        );

  try {
    const decoded = await getAuthFromToken(token);
    const { taskId, userId } = decoded;

    const formData = await request.formData();
    const text = (formData.get("text") || "").trim();
    if (!text) return ampFail("Comment cannot be empty.");
    if (text.length > 1000)
      return ampFail("Comment is too long (max 1000 characters).");

    await ensureDbConnection();
    const [task, user] = await Promise.all([
      Task.findById(taskId),
      User.findById(userId).select("name email"),
    ]);

    if (!task || !user) return ampFail("Task or user not found.");

    if (task.reminderState?.length) {
      task.reminderState = task.reminderState.map((entry) => {
        if (entry.user?.toString() !== userId) {
          return entry;
        }
        return pauseReminderStateEntry(entry, "commented", "comment");
      });
    }

    task.comments.push({ user: userId, text, createdAt: new Date() });
    await task.save();

    await Activity.create({
      user: userId,
      type: "task_updated",
      description: `${user.name} commented on task "${task.title}" via email`,
      entityId: task._id,
      entityType: "Task",
    });

    const assigner = await User.findById(task.assignedBy).select("email name");
    if (assigner?.email) {
      await Notification.create({
        recipient: task.assignedBy,
        sender: userId,
        title: "New Comment on Task",
        message: `${user.name} commented on "${task.title}": "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`,
        type: "task_updated",
        entityId: task._id,
        entityType: "Task",
      });
    }

    return ampOk("Your comment has been added to the task.");
  } catch (err) {
    const msg =
      err.name === "TokenExpiredError"
        ? "This link has expired"
        : "Invalid link";
    return ampFail(msg);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: ampCorsHeaders() });
}
