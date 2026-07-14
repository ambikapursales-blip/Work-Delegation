import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Conversation from "@/src/models/Conversation";
import Task from "@/src/models/Task";
import User from "@/src/models/User";
import Message from "@/src/models/Message";

export async function GET(request) {
  const res = createRes();
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;

  try {
    const isSuperAdmin = user.role === "Super Admin";
    const canViewAll = user.canViewAllTasks;

    if (isSuperAdmin || canViewAll) {
      return await getSuperAdminView(user, res);
    }

    return await getNormalUserView(user, res);
  } catch (error) {
    return finishRes(
      res.status(500).json({ success: false, message: "Server error" }),
    );
  }
}

async function getSuperAdminView(user, res) {
  const conversations = await Conversation.find({})
    .populate({
      path: "taskId",
      select: "title status assignedTo assignedBy deadline priority",
    })
    .populate({
      path: "lastMessage",
      select: "text type sender createdAt",
      populate: { path: "sender", select: "name" },
    })
    .sort({ lastActivityAt: -1 })
    .lean();

  const employeeConversations = {};

  for (const conv of conversations) {
    const task = conv.taskId;
    if (!task) continue;

    const lastMsg = conv.lastMessage;
    let lastMessageText = "";
    if (lastMsg) {
      if (lastMsg.type === "text" && lastMsg.text) {
        lastMessageText = lastMsg.text;
      } else if (
        [
          "status_change",
          "deadline_extend",
          "task_completed",
          "task_assigned",
          "task_reopened",
          "task_accepted",
          "task_rejected",
          "priority_changed",
          "assignee_changed",
        ].includes(lastMsg.type)
      ) {
        lastMessageText = lastMsg.text || "";
      } else if (lastMsg.type === "file_upload") {
        lastMessageText = "Uploaded a file";
      } else if (lastMsg.type === "extension_requested") {
        lastMessageText = "Extension requested";
      } else if (lastMsg.type === "extension_approved") {
        lastMessageText = "Extension approved";
      } else if (lastMsg.type === "extension_rejected") {
        lastMessageText = "Extension rejected";
      } else {
        lastMessageText = lastMsg.text || "";
      }
    }

    const assigneeIds = Array.isArray(task.assignedTo)
      ? task.assignedTo.map((a) => a.toString())
      : [task.assignedTo?.toString()];

    for (const empId of assigneeIds) {
      if (!employeeConversations[empId]) {
        employeeConversations[empId] = { tasks: [], unreadTotal: 0 };
      }
      employeeConversations[empId].tasks.push({
        _id: conv._id,
        taskId: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline,
        lastActivityAt: conv.lastActivityAt,
        lastMessageTime: lastMsg?.createdAt || conv.lastActivityAt,
        lastMessageText,
        messageCount: conv.messageCount || 0,
        assignerId: task.assignedBy?.toString(),
      });
    }
  }

  const employeeIds = Object.keys(employeeConversations);
  const employees =
    employeeIds.length > 0
      ? await User.find({ _id: { $in: employeeIds } })
          .select("name email role avatar employeeId")
          .lean()
      : [];
  const employeeMap = {};
  for (const e of employees) {
    employeeMap[e._id.toString()] = e;
  }

  const allTaskIds = conversations
    .filter((c) => c.taskId)
    .map((c) => c.taskId._id);

  const unreadCounts =
    allTaskIds.length > 0
      ? await Promise.all(
          conversations.map(async (c) => {
            const tid = c.taskId?._id?.toString() || c.taskId?.toString();
            const participant = c.participants?.find(
              (p) => p.userId && p.userId.toString() === user._id.toString(),
            );
            const lastReadAt = participant?.lastReadAt || null;
            const match = {
              taskId: c.taskId?._id || c.taskId,
              sender: { $ne: user._id },
              isDeleted: { $ne: true },
            };
            if (lastReadAt) {
              match.createdAt = { $gt: new Date(lastReadAt) };
            }
            const count = await Message.countDocuments(match);
            return { _id: tid, count };
          }),
        )
      : [];

  const unreadMap = {};
  for (const u of unreadCounts) {
    unreadMap[u._id] = u.count;
  }

  const result = employeeIds
    .map((empId) => {
      const empConv = employeeConversations[empId];
      let totalUnread = 0;
      const tasks = empConv.tasks.map((t) => {
        const unread = unreadMap[t.taskId.toString()] || 0;
        totalUnread += unread;
        return { ...t, unreadCount: unread };
      });
      return {
        groupBy: "employee",
        user: employeeMap[empId] || { _id: empId, name: "Unknown" },
        unreadTotal: totalUnread,
        tasks: tasks.sort(
          (a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt),
        ),
      };
    })
    .sort((a, b) => {
      const aLast = a.tasks[0]?.lastActivityAt || 0;
      const bLast = b.tasks[0]?.lastActivityAt || 0;
      return new Date(bLast) - new Date(aLast);
    });

  return finishRes(res.status(200).json({ success: true, data: result }));
}

async function getNormalUserView(user, res) {
  const taskMatch = {
    $or: [{ assignedTo: user._id }, { assignedBy: user._id }],
  };

  if (user.role === "Manager") {
    const teamMembers = await User.find({ managerId: user._id })
      .select("_id")
      .lean();
    const teamIds = teamMembers.map((member) => member._id);
    if (teamIds.length > 0) {
      taskMatch.$or.push({ assignedTo: { $in: teamIds } });
    }
  }

  const userTasks = await Task.find(taskMatch)
    .select("title status assignedTo assignedBy deadline priority createdAt")
    .populate("assignedBy", "name email role avatar")
    .lean();

  const taskIds = userTasks.map((t) => t._id);
  const conversations = await Conversation.find({ taskId: { $in: taskIds } })
    .populate({
      path: "lastMessage",
      select: "text type sender createdAt",
      populate: { path: "sender", select: "name" },
    })
    .sort({ lastActivityAt: -1 })
    .lean();

  const convMap = {};
  for (const c of conversations) {
    convMap[c.taskId.toString()] = c;
  }

  const unreadCounts =
    taskIds.length > 0
      ? await Promise.all(
          taskIds.map(async (tid) => {
            const c = convMap[tid.toString()];
            const participant = c?.participants?.find(
              (p) => p.userId && p.userId.toString() === user._id.toString(),
            );
            const lastReadAt = participant?.lastReadAt || null;
            const match = {
              taskId: tid,
              sender: { $ne: user._id },
              isDeleted: { $ne: true },
            };
            if (lastReadAt) {
              match.createdAt = { $gt: new Date(lastReadAt) };
            }
            const count = await Message.countDocuments(match);
            return { _id: tid.toString(), count };
          }),
        )
      : [];

  const unreadMap = {};
  for (const u of unreadCounts) {
    unreadMap[u._id] = u.count;
  }

  const assignerGroups = {};

  for (const task of userTasks) {
    const assigner = task.assignedBy;
    const assignerId =
      assigner?._id?.toString() || task.assignedBy?.toString() || "unknown";
    const assignerName = assigner?.name || "Unknown";

    if (!assignerGroups[assignerId]) {
      assignerGroups[assignerId] = {
        groupBy: "assigner",
        user: assigner || { _id: assignerId, name: assignerName },
        unreadTotal: 0,
        tasks: [],
      };
    }

    const conv = convMap[task._id.toString()];
    const unread = unreadMap[task._id.toString()] || 0;
    const lastMsg = conv?.lastMessage;
    let lastMessageText = "";
    if (lastMsg) {
      if (lastMsg.type === "text" && lastMsg.text) {
        lastMessageText = lastMsg.text;
      } else if (
        [
          "status_change",
          "deadline_extend",
          "task_completed",
          "task_assigned",
          "task_reopened",
          "task_accepted",
          "task_rejected",
          "priority_changed",
          "assignee_changed",
        ].includes(lastMsg.type)
      ) {
        lastMessageText = lastMsg.text || "";
      } else if (lastMsg.type === "file_upload") {
        lastMessageText = "Uploaded a file";
      } else if (lastMsg.type === "extension_requested") {
        lastMessageText = "Extension requested";
      } else if (lastMsg.type === "extension_approved") {
        lastMessageText = "Extension approved";
      } else if (lastMsg.type === "extension_rejected") {
        lastMessageText = "Extension rejected";
      } else {
        lastMessageText = lastMsg.text || "";
      }
    }

    assignerGroups[assignerId].tasks.push({
      _id: conv?._id || null,
      taskId: task._id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      lastActivityAt: conv?.lastActivityAt || task.createdAt,
      lastMessageTime:
        lastMsg?.createdAt || conv?.lastActivityAt || task.createdAt,
      lastMessageText,
      messageCount: conv?.messageCount || 0,
      unreadCount: unread,
    });

    assignerGroups[assignerId].unreadTotal += unread;
  }

  const result = Object.values(assignerGroups)
    .map((group) => {
      group.tasks.sort(
        (a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt),
      );
      return group;
    })
    .sort((a, b) => {
      const aLast = a.tasks[0]?.lastActivityAt || 0;
      const bLast = b.tasks[0]?.lastActivityAt || 0;
      return new Date(bLast) - new Date(aLast);
    });

  return finishRes(res.status(200).json({ success: true, data: result }));
}
