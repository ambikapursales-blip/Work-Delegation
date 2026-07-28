import Task from "../models/Task.js";
import User from "../models/User.js";
import { generateCompleteToken } from "./completeToken.js";
import { generateCommentToken } from "./commentToken.js";
import { generateExtensionToken } from "./extensionToken.js";
import { getKolkataDateParts, createKolkataDate } from "./istTime.js";

const RECURRING_TASK_TYPES = [
  "Daily", "Weekly", "Monthly", "Quarterly", "Half Yearly", "Yearly",
];

const MAX_TASK_CARDS = 20;

/**
 * Build recurring summary data grouped by user.
 *
 * All date boundaries for task categorization are computed in IST
 * (Asia/Kolkata) using the istTime helpers, ensuring tasks created or
 * completed at IST midnight boundaries are correctly attributed.
 *
 * @param {Object} options
 * @param {Date}   options.activeAsOf        - Compute active/overdue counts as of this date (usually now)
 * @param {Date}   [options.assignedSince]   - Count tasks assigned (createdAt) since this date (UTC-based query boundary)
 * @param {Date}   [options.assignedUntil]   - Count tasks assigned until this date
 * @param {Date}   [options.completedSince]  - Count tasks completed since this date
 * @param {Date}   [options.completedUntil]  - Count tasks completed until this date
 * @param {number} [options.maxCards=20]     - Maximum task cards per user
 * @returns {Promise<Map<string, {user, stats, taskCards, overdueCards, todayCards, pendingCards, taskCardsTruncated}>>}
 */
export async function buildRecurringSummary(options = {}) {
  const {
    activeAsOf = new Date(),
    assignedSince,
    assignedUntil,
    completedSince,
    completedUntil,
    maxCards = MAX_TASK_CARDS,
  } = options;

  // ── IST boundaries for task categorization ─────────────────────────
  // Compute today's IST date parts from activeAsOf, then build UTC Date
  // objects that correspond to IST midnight → IST 23:59:59.
  const { year, month, day } = getKolkataDateParts(activeAsOf);
  const todayStartIST = createKolkataDate(year, month, day, 0, 0, 0);
  const todayEndIST = createKolkataDate(year, month, day, 23, 59, 59, 999);

  const isDueToday = (task) =>
    task.deadline &&
    task.deadline >= todayStartIST &&
    task.deadline <= todayEndIST;

  const isOverdue = (task) =>
    task.status === "Overdue" ||
    (task.deadline && new Date(task.deadline) < activeAsOf);

  // ── 1. All active recurring tasks (not Completed / Cancelled) ────────
  // Exclude master/parent tasks (isRecurring: true) — they are templates,
  // not actual work items. Only generated occurrences count toward stats.
  const activeTasks = await Task.find({
    taskType: { $in: RECURRING_TASK_TYPES },
    status: { $nin: ["Completed", "Cancelled"] },
    isRecurring: { $ne: true },
  })
    .select("title description deadline priority status taskType assignedTo assignedBy createdAt")
    .populate("assignedBy", "name")
    .lean();

  // ── 2. Tasks completed in the completed window ───────────────────────
  const completedWindow = {};
  if (completedSince) completedWindow.$gte = completedSince;
  if (completedUntil) completedWindow.$lte = completedUntil;

  const completedInRange = Object.keys(completedWindow).length > 0
    ? await Task.find({
        taskType: { $in: RECURRING_TASK_TYPES },
        status: "Completed",
        completedAt: completedWindow,
        isRecurring: { $ne: true },
      })
        .select("title description deadline priority status taskType assignedTo assignedBy createdAt completedAt")
        .populate("assignedBy", "name")
        .lean()
    : [];

  // ── 3. Tasks assigned in the assigned window ─────────────────────────
  const assignedWindow = {};
  if (assignedSince) assignedWindow.$gte = assignedSince;
  if (assignedUntil) assignedWindow.$lte = assignedUntil;

  const assignedInRange = Object.keys(assignedWindow).length > 0
    ? await Task.find({
        taskType: { $in: RECURRING_TASK_TYPES },
        createdAt: assignedWindow,
        isRecurring: { $ne: true },
      })
        .select("title description deadline priority status taskType assignedTo assignedBy createdAt")
        .populate("assignedBy", "name")
        .lean()
    : [];

  // ── 4. Collect unique user IDs ───────────────────────────────────────
  const userIds = new Set();
  const addUserIds = (tasks) => {
    for (const t of tasks) {
      if (Array.isArray(t.assignedTo)) {
        for (const uid of t.assignedTo) {
          userIds.add(String(uid));
        }
      }
    }
  };
  addUserIds(activeTasks);
  addUserIds(completedInRange);
  addUserIds(assignedInRange);

  if (userIds.size === 0) return new Map();

  // ── 5. Fetch users ──────────────────────────────────────────────────
  const users = await User.find({ _id: { $in: [...userIds] } })
    .select("_id name email")
    .lean();

  const userMap = new Map();
  for (const u of users) {
    userMap.set(String(u._id), u);
  }

  // ── 6. Compute total-ever completed count for completion rate ────────
  const allCompletedTasks = await Task.find({
    taskType: { $in: RECURRING_TASK_TYPES },
    status: "Completed",
    isRecurring: { $ne: true },
  })
    .select("assignedTo")
    .lean();

  const completedEverCount = new Map();
  for (const t of allCompletedTasks) {
    if (Array.isArray(t.assignedTo)) {
      for (const uid of t.assignedTo) {
        const key = String(uid);
        completedEverCount.set(key, (completedEverCount.get(key) || 0) + 1);
      }
    }
  }

  // ── 7. Build per-user result ─────────────────────────────────────────
  const result = new Map();

  const initUser = (userId) => {
    if (!result.has(userId)) {
      const user = userMap.get(userId) || { _id: userId, name: "Unknown", email: null };
      result.set(userId, {
        user,
        stats: {
          totalActive: 0,
          overdue: 0,
          assignedInPeriod: 0,
          completedInPeriod: 0,
          completedEver: 0,
          completionRate: 0,
          pendingYesterday: 0,
        },
        taskCards: [],
        taskCardsTruncated: false,
        overdueCards: [],
        todayCards: [],
        pendingCards: [],
      });
    }
    return result.get(userId);
  };

  // Active + overdue tasks — counted per assignee
  for (const task of activeTasks) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    for (const assigneeId of assignees) {
      const uid = String(assigneeId);
      const entry = initUser(uid);
      entry.stats.totalActive++;

      if (isOverdue(task)) {
        entry.stats.overdue++;
      }
    }
  }

  // Completed in period — counted per assignee
  for (const task of completedInRange) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    for (const assigneeId of assignees) {
      const uid = String(assigneeId);
      const entry = initUser(uid);
      entry.stats.completedInPeriod++;
    }
  }

  // Assigned in period — counted per assignee
  for (const task of assignedInRange) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    for (const assigneeId of assignees) {
      const uid = String(assigneeId);
      const entry = initUser(uid);
      entry.stats.assignedInPeriod++;
    }
  }

  // Completed ever + completion rate
  for (const [uid, count] of completedEverCount) {
    const entry = result.get(uid);
    if (entry) {
      entry.stats.completedEver = count;
      const total = entry.stats.totalActive + count;
      entry.stats.completionRate = total > 0 ? Math.round((count / total) * 100) : 0;
    }
  }

  // ── 8. Compute pendingYesterday ──────────────────────────────────────
  // pendingYesterday = currently active + completed yesterday - assigned today
  // This estimates how many tasks were pending as of end of yesterday (IST).
  // The formula works because:
  //   active = (tasks active before today + tasks assigned today that remain active)
  //   active - assignedToday + completedYesterday = tasks active before today + completed yesterday
  //   = tasks that were not completed as of end of yesterday
  for (const [, entry] of result) {
    entry.stats.pendingYesterday =
      entry.stats.totalActive +
      entry.stats.completedInPeriod -
      entry.stats.assignedInPeriod;
    if (entry.stats.pendingYesterday < 0) entry.stats.pendingYesterday = 0;
  }

  // ── 9. Build task cards, categorized ─────────────────────────────────
  // Categorize into overdueCards, todayCards, pendingCards (up to maxCards total).
  // isDueToday uses IST-based boundaries so deadlines at IST 11:59 PM are
  // correctly attributed to today, and deadlines at IST 12:00 AM to tomorrow.
  for (const task of activeTasks) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    for (const assigneeId of assignees) {
      const uid = String(assigneeId);
      const entry = result.get(uid);
      if (!entry) continue;

      const totalCards = entry.overdueCards.length + entry.todayCards.length + entry.pendingCards.length;
      if (totalCards >= maxCards) {
        entry.taskCardsTruncated = true;
        continue;
      }

      const assigneeUserId = String(assigneeId);
      const taskId = String(task._id);
      const completeToken = generateCompleteToken(taskId, assigneeUserId);
      const commentToken = generateCommentToken(taskId, assigneeUserId);
      const extensionToken = generateExtensionToken(taskId, assigneeUserId);

      const cardData = {
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        priority: task.priority,
        status: task.status,
        taskType: task.taskType,
        assignedBy: task.assignedBy?.name || "Unknown",
        assignedTo: entry.user.name,
        createdAt: task.createdAt,
        taskId: task._id,
        userId: assigneeId,
        completeToken,
        commentToken,
        extensionToken,
      };

      entry.taskCards.push(cardData);

      if (isOverdue(task)) {
        entry.overdueCards.push(cardData);
      } else if (isDueToday(task)) {
        entry.todayCards.push(cardData);
      } else {
        entry.pendingCards.push(cardData);
      }
    }
  }

  // Sort each card category by deadline (nulls last)
  const sortByDeadline = (a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  };
  for (const [, entry] of result) {
    entry.taskCards.sort(sortByDeadline);
    entry.overdueCards.sort(sortByDeadline);
    entry.todayCards.sort(sortByDeadline);
    entry.pendingCards.sort(sortByDeadline);
  }

  return result;
}
