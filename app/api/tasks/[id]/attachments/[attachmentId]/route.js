import { NextResponse } from "next/server";
import { ensureDbConnection, requireAuth } from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "tasks");

const MB = 1024 * 1024;

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const { id, attachmentId } = params;
  const task = await Task.findById(id);
  if (!task) {
    return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
  }

  const isAssignee = task.assignedTo.some((a) => a.toString() === user._id.toString());
  const isAssigner = task.assignedBy.toString() === user._id.toString();
  const isAdmin = user.role === "Super Admin" || user.canAssignTasks;
  if (!isAssignee && !isAssigner && !isAdmin) {
    return NextResponse.json({ success: false, message: "Not authorized" }, { status: 403 });
  }

  const attachment = task.attachments.id(attachmentId);
  if (!attachment) {
    return NextResponse.json({ success: false, message: "Attachment not found" }, { status: 404 });
  }

  const ext = path.extname(attachment.name);
  const storedName = `${attachmentId}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storedName);

  try {
    await fs.access(filePath);
  } catch {
    return NextResponse.json({ success: false, message: "File not found on disk" }, { status: 404 });
  }

  const stat = await fs.stat(filePath);
  const fileBuffer = await fs.readFile(filePath);

  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".zip": "application/zip",
  };

  const contentType = mimeTypes[ext.toLowerCase()] || "application/octet-stream";

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${attachment.name}"`,
      "Content-Length": String(stat.size),
    },
  });
}

export async function DELETE(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const { id, attachmentId } = params;
  const task = await Task.findById(id);
  if (!task) {
    return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
  }

  const isAssigner = task.assignedBy.toString() === user._id.toString();
  const isAdmin = user.role === "Super Admin" || user.canAssignTasks;
  if (!isAssigner && !isAdmin) {
    return NextResponse.json({ success: false, message: "Not authorized" }, { status: 403 });
  }

  const attachment = task.attachments.id(attachmentId);
  if (!attachment) {
    return NextResponse.json({ success: false, message: "Attachment not found" }, { status: 404 });
  }

  const ext = path.extname(attachment.name);
  const storedName = `${attachmentId}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storedName);

  try {
    await fs.unlink(filePath);
  } catch {
    // File may not exist on disk — still remove the reference
  }

  task.attachments.pull(attachmentId);
  await task.save();

  return NextResponse.json({ success: true, attachments: task.attachments });
}
