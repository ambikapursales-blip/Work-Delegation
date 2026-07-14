import { NextResponse } from "next/server";
import { ensureDbConnection, requireAuth } from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import User from "@/src/models/User";
import Notification from "@/src/models/Notification";
import Activity from "@/src/models/Activity";
import { notifyExtensionRequested } from "@/src/utils/conversationMessages.js";

export async function POST(request, { params }) {
  try {
    await ensureDbConnection();
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    const { id } = params;
    const { revisedTargetDate, reason } = await request.json();

    if (!revisedTargetDate) {
      return NextResponse.json(
        { success: false, message: "Revised target date is required" },
        { status: 400 },
      );
    }

    const parsedDate = new Date(revisedTargetDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid revised target date" },
        { status: 400 },
      );
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "Reason is required" },
        { status: 400 },
      );
    }

    if (reason.length > 1000) {
      return NextResponse.json(
        { success: false, message: "Reason is too long (max 1000 characters)" },
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

    const isAssignee = Array.isArray(task.assignedTo)
      ? task.assignedTo.some(
          (a) => a._id?.toString() === user._id.toString() || a.toString() === user._id.toString(),
        )
      : task.assignedTo?.toString() === user._id.toString();

    if (!isAssignee) {
      return NextResponse.json(
        { success: false, message: "Only assigned users can request an extension" },
        { status: 403 },
      );
    }

    const pendingRequest = task.extensionRequests.find(
      (r) => r.user?.toString() === user._id.toString() && r.status === "pending",
    );
    if (pendingRequest) {
      return NextResponse.json(
        { success: false, message: "You already have a pending extension request for this task" },
        { status: 400 },
      );
    }

    task.extensionRequests.push({
      user: user._id,
      revisedTargetDate: parsedDate,
      reason: reason.trim(),
      status: "pending",
      requestedAt: new Date(),
    });
    await task.save();

    let extMessage = null;
    try {
      extMessage = await notifyExtensionRequested(
        task._id, user._id, user.name, reason.trim(), parsedDate,
      );
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
      sender: user._id,
      title: "Revised Target Date Requested",
      message: `${user.name} requested a revised target date of ${parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} for task "${task.title}"${reason ? `: ${reason}` : ""}`,
      type: "task_updated",
      entityId: task._id,
      entityType: "Task",
      conversationId: extConversation?._id,
      messageId: extMessage?._id,
    });

    await Activity.create({
      user: user._id,
      type: "task_updated",
      description: `${user.name} requested a revised target date for task "${task.title}"`,
      entityId: task._id,
      entityType: "Task",
    });

    return NextResponse.json({
      success: true,
      message: "Extension request submitted successfully",
    });
  } catch (err) {
    console.error("[Extend] error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
