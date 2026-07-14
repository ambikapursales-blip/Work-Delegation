import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Notification from "@/src/models/Notification";
import Task from "@/src/models/Task";
import Activity from "@/src/models/Activity";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();

  try {
    const filter = req.query.filter || "all";
    const userId = req.query.userId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let items = [];
    let activities = [];

    // For Super Admin viewing other users' reports
    const targetUserId = userId && (user.role === "Super Admin" || user.canViewAllTasks) ? userId : user._id;

    const taskQuery = { assignedBy: targetUserId };

    const pendingExtensions = await Task.find({
      ...taskQuery,
      "extensionRequests.status": "pending",
    })
      .populate("extensionRequests.user", "name email")
      .select("title priority deadline assignedBy extensionRequests")
      .lean();

    for (const task of pendingExtensions) {
      for (const req of task.extensionRequests) {
        if (req.status === "pending") {
          items.push({
            type: "extension_request",
            _id: req._id.toString(),
            taskId: task._id.toString(),
            taskTitle: task.title,
            priority: task.priority,
            currentDeadline: task.deadline,
            revisedTargetDate: req.revisedTargetDate,
            reason: req.reason || "",
            requestedAt: req.requestedAt,
            actor: req.user,
            isRead: false,
            createdAt: req.requestedAt,
          });
        }
      }
    }

    const notificationsQuery = {
      recipient: targetUserId,
      isRead: false,
      createdAt: { $gte: thirtyDaysAgo },
    };

    if (filter === "pending") {
      notificationsQuery.type = { $in: ["task_completed"] };
    } else if (filter === "comments") {
      notificationsQuery.title = "New Comment on Task";
    } else if (filter === "deadline") {
      notificationsQuery.type = { $in: ["deadline_extended"] };
    }

    const notifications = await Notification.find(notificationsQuery)
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const taskIds = notifications
      .filter((n) => n.entityId)
      .map((n) => n.entityId.toString());

    const tasks = await Task.find({ _id: { $in: taskIds } })
      .select("title priority deadline assignedBy")
      .lean();
    const taskMap = {};
    for (const t of tasks) {
      taskMap[t._id.toString()] = t;
    }

    for (const notif of notifications) {
      if (notif.type === "task_completed") {
        const task = taskMap[notif.entityId?.toString()];
        if (!task) continue;
        items.push({
          type: "task_completed",
          _id: notif._id.toString(),
          taskId: notif.entityId?.toString(),
          taskTitle: task.title,
          priority: task.priority,
          deadline: task.deadline,
          completedAt: notif.createdAt,
          actor: notif.sender,
          isRead: notif.isRead,
          createdAt: notif.createdAt,
          notificationId: notif._id.toString(),
        });
      } else if (notif.title === "New Comment on Task") {
        const task = taskMap[notif.entityId?.toString()];
        if (!task) continue;
        const commentMatch = notif.message.match(/".*"/);
        const commentText = commentMatch
          ? notif.message.substring(notif.message.indexOf('"'), notif.message.lastIndexOf('"') + 1)
          : "";
        items.push({
          type: "comment",
          _id: notif._id.toString(),
          taskId: notif.entityId?.toString(),
          taskTitle: task.title,
          priority: task.priority,
          deadline: task.deadline,
          commentText,
          commentedAt: notif.createdAt,
          actor: notif.sender,
          isRead: notif.isRead,
          createdAt: notif.createdAt,
          notificationId: notif._id.toString(),
        });
      }
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const pendingCount = items.filter((i) => !i.isRead).length;

    const activityQuery = {
      entityType: "Task",
      user: targetUserId,
      createdAt: { $gte: thirtyDaysAgo },
    };

    if (filter === "completed") {
      activityQuery.type = "task_completed";
    } else if (filter === "comments") {
      activityQuery.type = "task_updated";
    } else if (filter === "deadline") {
      activityQuery.description = /revised target date/i;
    }

    if (filter === "pending") {
      activities = [];
    } else {
      activities = await Activity.find(activityQuery)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    }

    res.status(200).json({
      success: true,
      items,
      pendingCount,
      activities,
    });
  } catch (error) {
    console.error("[ActionCenter] Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
