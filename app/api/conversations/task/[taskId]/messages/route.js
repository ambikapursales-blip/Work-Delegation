import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Message from "@/src/models/Message";
import Conversation from "@/src/models/Conversation";
import Task from "@/src/models/Task";
import Notification from "@/src/models/Notification";
import Activity from "@/src/models/Activity";
import User from "@/src/models/User";
import {
  canAccessConversation,
  canSendMessage,
  buildActionUrl,
  getConversationParticipants,
} from "@/src/utils/conversationAuth";

export async function GET(request, { params }) {
  const res = createRes();
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;

  try {
    const task = await Task.findById(req.params.taskId)
      .select("title assignedTo assignedBy")
      .lean();

    if (!task) {
      return finishRes(
        res.status(404).json({ success: false, message: "Task not found" }),
      );
    }

    const authorized = await canAccessConversation(user, task);
    if (!authorized) {
      return finishRes(
        res.status(403).json({ success: false, message: "Not authorized" }),
      );
    }

    const { cursor, limit = 50, direction = "before" } = req.query;
    const pageSize = Math.min(parseInt(limit), 100);

    let query = {
      taskId: req.params.taskId,
      isDeleted: { $ne: true },
    };

    if (cursor) {
      const cursorDoc = await Message.findById(cursor)
        .select("createdAt")
        .lean();
      if (cursorDoc) {
        if (direction === "before") {
          query.createdAt = { $lt: cursorDoc.createdAt };
        } else {
          query.createdAt = { $gt: cursorDoc.createdAt };
        }
      }
    }

    const messages = await Message.find(query)
      .populate("sender", "name email role avatar")
      .populate("parentId", "text type sender")
      .sort({ createdAt: direction === "after" ? 1 : -1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = messages.length > pageSize;
    if (hasMore) messages.pop();

    if (direction !== "after") {
      messages.reverse();
    }

    const nextCursor =
      messages.length > 0 ? messages[messages.length - 1]._id : null;
    const prevCursor = messages.length > 0 ? messages[0]._id : null;

    return finishRes(
      res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          nextCursor,
          prevCursor,
          hasMore,
          hasPrev: !!cursor,
        },
      }),
    );
  } catch (error) {
    return finishRes(
      res.status(500).json({ success: false, message: "Server error" }),
    );
  }
}

export async function POST(request, { params }) {
  const res = createRes();
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;

  try {
    const task = await Task.findById(req.params.taskId)
      .select("title assignedTo assignedBy")
      .lean();

    if (!task) {
      return finishRes(
        res.status(404).json({ success: false, message: "Task not found" }),
      );
    }

    const authorized = await canSendMessage(user, task);
    if (!authorized) {
      return finishRes(
        res
          .status(403)
          .json({ success: false, message: "Not authorized to send messages" }),
      );
    }

    const { text, type = "text", parentId, attachments, mentions } = req.body;

    if (!text && type === "text") {
      return finishRes(
        res
          .status(400)
          .json({ success: false, message: "Message text is required" }),
      );
    }

    if (text && text.length > 5000) {
      return finishRes(
        res
          .status(400)
          .json({
            success: false,
            message: "Message exceeds 5000 character limit",
          }),
      );
    }

    let conversation = await Conversation.findOne({ taskId: task._id });
    if (!conversation) {
      const participants = getConversationParticipants(task);
      conversation = await Conversation.create({
        taskId: task._id,
        participants,
        lastActivityAt: new Date(),
        messageCount: 0,
      });
    }

    const message = await Message.create({
      taskId: task._id,
      sender: user._id,
      text: text || "",
      type,
      parentId: parentId || null,
      attachments: attachments || [],
      mentions: mentions || [],
    });

    conversation.lastMessage = message._id;
    conversation.lastActivityAt = new Date();
    conversation.messageCount = (conversation.messageCount || 0) + 1;
    await conversation.save();

    const assigneeIds = Array.isArray(task.assignedTo)
      ? task.assignedTo.map((a) => a.toString())
      : [task.assignedTo?.toString()];
    const assignerId = task.assignedBy?.toString();
    const allRecipientIds = [
      ...new Set([...assigneeIds, assignerId].filter(Boolean)),
    ];

    const notificationPayload = [];
    for (const recipientId of allRecipientIds) {
      if (recipientId === user._id.toString()) continue;

      let notifType = "message_sent";
      let notifTitle = "New Message";
      let notifMessage = `${user.name}: ${(text || "").slice(0, 200)}`;

      if (type === "file_upload") {
        notifType = "file_uploaded";
        notifTitle = "File Uploaded";
        notifMessage = `${user.name} uploaded a file in "${task.title}"`;
      } else if (type === "status_change") {
        notifType = "status_changed";
        notifTitle = "Status Updated";
        const meta = req.body.metadata || {};
        notifMessage = `${user.name} changed status to ${meta.newStatus || "updated"} in "${task.title}"`;
      } else if (type === "deadline_extend") {
        notifType = "deadline_extended";
        notifTitle = "Deadline Extended";
        notifMessage = `${user.name} requested deadline extension in "${task.title}"`;
      }

      if (type === "text") {
        notifType = "message_sent";
        notifTitle = "New Message";
        notifMessage = `${user.name}: ${(text || "").slice(0, 200)}`;
      }

      notificationPayload.push({
        recipient: recipientId,
        sender: user._id,
        type: notifType,
        title: notifTitle,
        message: notifMessage,
        entityId: task._id,
        entityType: "Task",
        conversationId: conversation._id,
        messageId: message._id,
        actionUrl: buildActionUrl(task._id, message._id),
      });
    }

    if (notificationPayload.length > 0) {
      await Notification.insertMany(notificationPayload);
    }

    await Activity.create({
      user: user._id,
      type: "task_updated",
      description: `${user.name} sent a message in "${task.title}"`,
      entityId: task._id,
      entityType: "Task",
      metadata: { messageId: message._id, conversationId: conversation._id },
    });

    const populated = await Message.findById(message._id)
      .populate("sender", "name email role avatar")
      .populate("parentId", "text type sender")
      .lean();

    return finishRes(res.status(201).json({ success: true, data: populated }));
  } catch (error) {
    return finishRes(
      res
        .status(500)
        .json({ success: false, message: error.message || "Server error" }),
    );
  }
}
