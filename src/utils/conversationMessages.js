import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

async function ensureConversation(taskId) {
  let conversation = await Conversation.findOne({ taskId });
  if (!conversation) {
    conversation = await Conversation.create({
      taskId,
      participants: [],
      lastActivityAt: new Date(),
      messageCount: 0,
    });
  }
  return conversation;
}

export async function createSystemMessage({ taskId, sender, type, text, metadata }) {
  const message = await Message.create({
    taskId,
    sender: sender || undefined,
    text,
    type: type || "system",
    metadata: metadata || {},
  });

  const conversation = await ensureConversation(taskId);
  conversation.lastMessage = message._id;
  conversation.lastActivityAt = new Date();
  conversation.messageCount = (conversation.messageCount || 0) + 1;
  await conversation.save();

  return message;
}

export async function notifyTaskAssigned(taskId, assignerId, assigneeNames) {
  return createSystemMessage({
    taskId,
    sender: assignerId,
    type: "task_assigned",
    text: `Task assigned to ${assigneeNames}`,
    metadata: { event: "assigned" },
  });
}

export async function notifyTaskCompleted(taskId, userId, userName) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "task_completed",
    text: `${userName} marked this task as completed`,
    metadata: { event: "completed" },
  });
}

export async function notifyTaskReopened(taskId, userId, userName) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "task_reopened",
    text: `${userName} reopened this task`,
    metadata: { event: "reopened" },
  });
}

export async function notifyStatusChanged(taskId, userId, userName, oldStatus, newStatus) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "status_change",
    text: `${userName} changed status from ${oldStatus} to ${newStatus}`,
    metadata: { event: "status_change", oldStatus, newStatus },
  });
}

export async function notifyDeadlineExtended(taskId, userId, userName, oldDate, newDate) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "deadline_extend",
    text: `${userName} extended deadline from ${oldDate ? new Date(oldDate).toLocaleDateString() : "N/A"} to ${newDate ? new Date(newDate).toLocaleDateString() : "N/A"}`,
    metadata: { event: "deadline_extend", oldDate, newDate },
  });
}

export async function notifyExtensionRequested(taskId, userId, userName, reason, requestedDate) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "extension_requested",
    text: `${userName} requested deadline extension to ${requestedDate ? new Date(requestedDate).toLocaleDateString() : "N/A"}${reason ? `: ${reason}` : ""}`,
    metadata: { event: "extension_requested", reason, requestedDate },
  });
}

export async function notifyExtensionResponded(taskId, userId, userName, status) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: status === "approved" ? "extension_approved" : "extension_rejected",
    text: `${userName} ${status} the extension request`,
    metadata: { event: `extension_${status}` },
  });
}

export async function notifyAttachmentUploaded(taskId, userId, userName, fileName) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "file_upload",
    text: `${userName} uploaded ${fileName}`,
    metadata: { event: "file_upload", fileName },
  });
}

export async function notifyCommentAdded(taskId, userId, userName, commentText) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "text",
    text: commentText,
    metadata: { event: "comment" },
  });
}

export async function notifyTaskAccepted(taskId, userId, userName) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "task_accepted",
    text: `${userName} accepted this task`,
    metadata: { event: "accepted" },
  });
}

export async function notifyTaskRejected(taskId, userId, userName, reason) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "task_rejected",
    text: `${userName} rejected this task${reason ? `: ${reason}` : ""}`,
    metadata: { event: "rejected", reason },
  });
}

export async function notifyPriorityChanged(taskId, userId, userName, oldPriority, newPriority) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "priority_changed",
    text: `${userName} changed priority from ${oldPriority} to ${newPriority}`,
    metadata: { event: "priority_changed", oldPriority, newPriority },
  });
}

export async function notifyAssigneeChanged(taskId, userId, userName, oldAssignees, newAssignees) {
  return createSystemMessage({
    taskId,
    sender: userId,
    type: "assignee_changed",
    text: `${userName} reassigned task from ${oldAssignees} to ${newAssignees}`,
    metadata: { event: "assignee_changed", oldAssignees, newAssignees },
  });
}
