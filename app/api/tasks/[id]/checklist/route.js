import { NextResponse } from "next/server";
import {
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import Activity from "@/src/models/Activity";

export async function POST(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const { id } = params;
  const { text } = await request.json();

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { success: false, message: "Checklist item text is required" },
      { status: 400 },
    );
  }
  if (text.length > 500) {
    return NextResponse.json(
      { success: false, message: "Text cannot exceed 500 characters" },
      { status: 400 },
    );
  }

  const task = await Task.findById(id);
  if (!task) {
    return NextResponse.json(
      { success: false, message: "Task not found" },
      { status: 404 },
    );
  }

  const isAssignee = task.assignedTo.some((a) => a.toString() === user._id.toString());
  const isAssigner = task.assignedBy.toString() === user._id.toString();
  const isAdmin = ["Super Admin", "Admin"].includes(user.role);
  if (!isAssignee && !isAssigner && !isAdmin) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }

  task.checklist.push({ text: text.trim() });
  await task.save();

  return NextResponse.json({
    success: true,
    checklist: task.checklist,
    checklistProgress: task.checklistProgress,
  });
}

export async function PATCH(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const { id } = params;
  const { itemId, completed } = await request.json();

  if (!itemId) {
    return NextResponse.json(
      { success: false, message: "itemId is required" },
      { status: 400 },
    );
  }

  const task = await Task.findById(id);
  if (!task) {
    return NextResponse.json(
      { success: false, message: "Task not found" },
      { status: 404 },
    );
  }

  const isAssignee = task.assignedTo.some((a) => a.toString() === user._id.toString());
  const isAssigner = task.assignedBy.toString() === user._id.toString();
  const isAdmin = ["Super Admin", "Admin"].includes(user.role);
  if (!isAssignee && !isAssigner && !isAdmin) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }

  const item = task.checklist.id(itemId);
  if (!item) {
    return NextResponse.json(
      { success: false, message: "Checklist item not found" },
      { status: 404 },
    );
  }

  if (item.completed === completed) {
    return NextResponse.json({
      success: true,
      checklist: task.checklist,
      checklistProgress: task.checklistProgress,
    });
  }

  item.completed = completed;
  item.completedAt = completed ? new Date() : null;
  item.completedBy = completed ? user._id : null;

  task.history.push({
    status: task.status,
    changedBy: user._id,
    changedAt: new Date(),
    note: completed
      ? `Completed checklist item: "${item.text}"`
      : `Reopened checklist item: "${item.text}"`,
  });

  await task.save();

  await Activity.create({
    user: user._id,
    type: "task_updated",
    description: `${user.name} ${completed ? "completed" : "reopened"} checklist item "${item.text}" on task "${task.title}"`,
    entityId: task._id,
    entityType: "Task",
  });

  return NextResponse.json({
    success: true,
    checklist: task.checklist,
    checklistProgress: task.checklistProgress,
  });
}
