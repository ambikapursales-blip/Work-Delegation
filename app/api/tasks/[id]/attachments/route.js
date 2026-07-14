import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ensureDbConnection, requireAuth } from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import Notification from "@/src/models/Notification";
import Activity from "@/src/models/Activity";
import { getConversationParticipants } from "@/src/utils/conversationAuth";
import { notifyAttachmentUploaded } from "@/src/utils/conversationMessages";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "tasks");

export async function POST(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const { id } = params;
  const task = await Task.findById(id);
  if (!task) {
    return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
  }

  const isAssignee = task.assignedTo.some((a) => a.toString() === user._id.toString());
  const isAssigner = task.assignedBy.toString() === user._id.toString();
  const isAdmin = ["Super Admin", "Admin"].includes(user.role);
  if (!isAssignee && !isAssigner && !isAdmin) {
    return NextResponse.json({ success: false, message: "Not authorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files");
  if (!files || files.length === 0) {
    return NextResponse.json({ success: false, message: "No files provided" }, { status: 400 });
  }

  const entries = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const attId = new mongoose.Types.ObjectId();
    const ext = path.extname(file.name);
    const storedName = `${attId}${ext}`;
    const filePath = path.join(UPLOAD_DIR, storedName);
    await fs.writeFile(filePath, buffer);

    entries.push({
      _id: attId,
      name: file.name,
      url: `/api/tasks/${id}/attachments/${attId}/download`,
      uploadedAt: new Date(),
    });
  }

  task.attachments.push(...entries);
  await task.save();

  // Create system message for each uploaded file
  for (const entry of entries) {
    try {
      await notifyAttachmentUploaded(task._id, user._id, user.name, entry.name);
    } catch (e) {
      console.error("Failed to create attachment system message:", e);
    }
  }

  // Notify participants
  try {
    const participants = await getConversationParticipants(task);
    const recipientIds = participants
      .filter((p) => p._id.toString() !== user._id.toString())
      .map((p) => p._id);
    if (recipientIds.length > 0) {
      const fileNames = entries.map((e) => e.name).join(", ");
      await Notification.create({
        recipient: recipientIds,
        sender: user._id,
        title: "Files Uploaded",
        message: `${user.name} uploaded ${fileNames} to task "${task.title}"`,
        type: "file_uploaded",
        entityId: task._id,
        entityType: "Task",
      });
    }
  } catch (e) {
    console.error("Failed to create attachment notification:", e);
  }

  // Log activity
  try {
    await Activity.create({
      user: user._id,
      type: "task_updated",
      description: `${user.name} uploaded ${entries.length} file(s) to task "${task.title}"`,
      entityId: task._id,
      entityType: "Task",
    });
  } catch (e) {
    console.error("Failed to create attachment activity:", e);
  }

  return NextResponse.json({ success: true, attachments: task.attachments });
}
