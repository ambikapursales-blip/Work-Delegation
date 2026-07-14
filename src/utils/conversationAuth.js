import User from "../models/User.js";

export async function canAccessConversation(user, task) {
  const isSuperAdmin = user.role === "Super Admin";
  const canViewAll = user.canViewAllTasks;

  if (isSuperAdmin || canViewAll) {
    return true;
  }

  const assigneeIds = Array.isArray(task.assignedTo)
    ? task.assignedTo.map((a) => a._id?.toString() || a.toString())
    : [task.assignedTo?._id?.toString() || task.assignedTo?.toString()];

  const taskAssignerId = task.assignedBy?._id?.toString() || task.assignedBy?.toString();
  const userId = user._id.toString();

  const isAssigned = assigneeIds.includes(userId);
  const isAssigner = taskAssignerId === userId;

  if (isAssigned || isAssigner) {
    return true;
  }

  if (user.role === "Manager") {
    const teamMembers = await User.find({ managerId: user._id })
      .select("_id")
      .lean();
    const teamIds = new Set(teamMembers.map((m) => m._id.toString()));
    return assigneeIds.some((id) => teamIds.has(id));
  }

  return false;
}

export async function canSendMessage(user, task) {
  return canAccessConversation(user, task);
}

export async function canEditMessage(user, message) {
  if (user.role === "Super Admin") return true;
  return message.sender.toString() === user._id.toString() && !message.isDeleted;
}

export async function canDeleteMessage(user, message) {
  if (user.role === "Super Admin") return true;
  return message.sender.toString() === user._id.toString() && !message.isDeleted;
}

export function buildActionUrl(taskId, messageId) {
  let url = `/dwr?tab=conversations&task=${taskId}`;
  if (messageId) {
    url += `&message=${messageId}`;
  }
  return url;
}

export function getConversationParticipants(task) {
  const participants = [];
  const addedIds = new Set();

  const assigneeIds = Array.isArray(task.assignedTo)
    ? task.assignedTo.map((a) => a._id?.toString() || a.toString())
    : [task.assignedTo?._id?.toString() || task.assignedTo?.toString()];

  const assignerId = task.assignedBy?._id?.toString() || task.assignedBy?.toString();

  for (const id of assigneeIds) {
    if (!addedIds.has(id)) {
      participants.push({ userId: id, role: "assignee" });
      addedIds.add(id);
    }
  }

  if (assignerId && !addedIds.has(assignerId)) {
    participants.push({ userId: assignerId, role: "assigner" });
    addedIds.add(assignerId);
  }

  return participants;
}
