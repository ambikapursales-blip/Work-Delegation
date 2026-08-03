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
 * @param {Date}   [options.yesterdayAssignedSince] - Count tasks assigned yesterday (createdAt) since this date
 * @param {Date}   [options.yesterdayAssignedUntil] - Count tasks assigned yesterday until this date
 * @param {Date}   [options.lastWeekAssignedSince]  - Count tasks assigned last week (createdAt) since this date
 * @param {Date}   [options.lastWeekAssignedUntil]  - Count tasks assigned last week until this date
 * @param {Date}   [options.dueSince]               - Categorize tasks due (deadline) since this date (weekly: this Monday)
 * @param {Date}   [options.dueUntil]               - Categorize tasks due until this date (weekly: this Saturday)
 * @param {boolean} [options.companyMode=false]     - Aggregate company-wide stats across all task types instead of per user (management summary)
 * @param {boolean} [options.includeAllTaskTypes=false] - Include ALL task types (One Time, Recurring, Custom) in per-user mode using the /tasks page parent-exclusion scope (daily path). Default false keeps the recurring-only scope (weekly/management).
 * @param {boolean} [options.perEmployee=false]     - When true (with companyMode), also build the per-employee performance table (active users excluding Super Admin) and the Total Employees count on the "company" entry.
 * @param {number} [options.maxCards=20]     - Maximum task cards per user
 * @returns {Promise<Map<string, {user, stats, taskCards, overdueCards, todayCards, pendingCards, inProgressCards, completedCards, todayAssignedCards, highPriorityCards, upcomingCards, dueThisWeekCards, dueTomorrowCards, topDepartments, taskCardsTruncated}>>}
 */
export async function buildRecurringSummary(options = {}) {
  const {
    activeAsOf = new Date(),
    assignedSince,
    assignedUntil,
    completedSince,
    completedUntil,
    yesterdayAssignedSince,
    yesterdayAssignedUntil,
    lastWeekAssignedSince,
    lastWeekAssignedUntil,
    dueSince,
    dueUntil,
    companyMode = false,
    includeAllTaskTypes = false,
    perEmployee = false,
    maxCards = MAX_TASK_CARDS,
  } = options;

  // Scope of task documents included in the summary:
  //  - companyMode: all task types (management summary), excluding master/parent tasks.
  //  - includeAllTaskTypes (daily path): all task types, using the same
  //    parent-exclusion shape as the /tasks page ($or of non-recurring or
  //    generated occurrences) so "Today's Work" matches the dashboard.
  //  - default (weekly path): the 6 recurring task types only.
  const scopeQuery = companyMode
    ? { isRecurring: { $ne: true } }
    : includeAllTaskTypes
      ? { $or: [{ isRecurring: { $ne: true } }, { isGeneratedOccurrence: true }] }
      : { taskType: { $in: RECURRING_TASK_TYPES }, isRecurring: { $ne: true } };

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

  // Due tomorrow (IST day after today) — used for the management summary.
  const tomorrowStartIST = new Date(todayEndIST.getTime() + 1);
  const tomorrowEndIST = new Date(
    todayEndIST.getTime() + 24 * 60 * 60 * 1000,
  );
  const isDueTomorrow = (task) =>
    task.deadline &&
    new Date(task.deadline) >= tomorrowStartIST &&
    new Date(task.deadline) <= tomorrowEndIST;

  const isOverdue = (task) =>
    task.status === "Overdue" ||
    (task.deadline && new Date(task.deadline) < activeAsOf);

  const isHighPriority = (task) =>
    task.priority === "High" || task.priority === "Critical";

  // Upcoming = active tasks with a deadline in the future (not today)
  // within the next 7 days, used for the "Upcoming Deadlines" section.
  const upcomingEndIST = new Date(
    todayEndIST.getTime() + 7 * 24 * 60 * 60 * 1000,
  );
  const isUpcoming = (task) =>
    !isOverdue(task) &&
    task.deadline &&
    new Date(task.deadline) > todayEndIST &&
    new Date(task.deadline) <= upcomingEndIST;

  // Due within the weekly window (Monday → Saturday IST), used for the
  // weekly "Tasks Due This Week" section. Only active when dueSince/dueUntil
  // are provided (weekly callers); daily callers get an empty list.
  const isDueThisWeek = (task) =>
    task.deadline &&
    dueSince &&
    dueUntil &&
    new Date(task.deadline) >= dueSince &&
    new Date(task.deadline) <= dueUntil;

  // Shared card builder — used by both the per-user paths (daily/weekly)
  // and the company-wide (management) path. Action tokens are generated per
  // assignee; company cards use the task's first assignee for the tokens.
  const buildCardData = (task, entry, assigneeId) => {
    const assigneeUserId = String(assigneeId);
    const taskId = String(task._id);
    const completeToken = generateCompleteToken(taskId, assigneeUserId);
    const commentToken = generateCommentToken(taskId, assigneeUserId);
    const extensionToken = generateExtensionToken(taskId, assigneeUserId);

    return {
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
  };


  // ── 1. All active recurring tasks (not Completed / Cancelled) ────────
  // Exclude master/parent tasks (isRecurring: true) — they are templates,
  // not actual work items. Only generated occurrences count toward stats.
  const activeTasks = await Task.find({
    ...scopeQuery,
    status: { $nin: ["Completed", "Cancelled"] },
  })
    .select("title description deadline priority status taskType assignedTo assignedBy createdAt department")
    .populate("assignedBy", "name")
    .lean();

  // ── 2. Tasks completed in the completed window ───────────────────────
  const completedWindow = {};
  if (completedSince) completedWindow.$gte = completedSince;
  if (completedUntil) completedWindow.$lte = completedUntil;

  const completedInRange = Object.keys(completedWindow).length > 0
    ? await Task.find({
        ...scopeQuery,
        status: "Completed",
        completedAt: completedWindow,
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
        ...scopeQuery,
        createdAt: assignedWindow,
      })
        .select("title description deadline priority status taskType assignedTo assignedBy createdAt")
        .populate("assignedBy", "name")
        .lean()
    : [];

  // ── 3b. Tasks assigned yesterday (for the daily performance email) ──
  const yesterdayAssignedWindow = {};
  if (yesterdayAssignedSince) yesterdayAssignedWindow.$gte = yesterdayAssignedSince;
  if (yesterdayAssignedUntil) yesterdayAssignedWindow.$lte = yesterdayAssignedUntil;

  const yesterdayAssignedInRange = Object.keys(yesterdayAssignedWindow).length > 0
    ? await Task.find({
        ...scopeQuery,
        createdAt: yesterdayAssignedWindow,
      })
        .select("title description deadline priority status taskType assignedTo assignedBy createdAt")
        .populate("assignedBy", "name")
        .lean()
    : [];

  // ── 3c. Tasks assigned last week (for the weekly performance email) ──
  const lastWeekAssignedWindow = {};
  if (lastWeekAssignedSince) lastWeekAssignedWindow.$gte = lastWeekAssignedSince;
  if (lastWeekAssignedUntil) lastWeekAssignedWindow.$lte = lastWeekAssignedUntil;

  const lastWeekAssignedInRange = Object.keys(lastWeekAssignedWindow).length > 0
    ? await Task.find({
        ...scopeQuery,
        createdAt: lastWeekAssignedWindow,
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
  addUserIds(yesterdayAssignedInRange);
  addUserIds(lastWeekAssignedInRange);

  // Company mode still produces a (zeroed) summary so the management email
  // is sent every day even when no users are referenced by any task.
  if (!companyMode && userIds.size === 0) return new Map();

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
    ...scopeQuery,
    status: "Completed",
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

  // ── 6b. Company-wide mode (Daily Management Summary) ─────────────────
  // Aggregates ALL tasks (every task type) into a single synthetic entry
  // so the management summary can be sent to every Super Admin. Reuses the
  // same arrays fetched above; no new query patterns. Cards use the task's
  // first assignee for action tokens. Returns a Map with one "company" key.
  if (companyMode) {
    const companyEntry = {
      user: { _id: "company", name: "Company", email: null },
      stats: {
        totalActive: 0,
        overdue: 0,
        assignedInPeriod: assignedInRange.length,
        completedInPeriod: completedInRange.length,
        completedEver: allCompletedTasks.length,
        completionRate: 0,
        totalEmployees: 0,
      },
      taskCards: [],
      taskCardsTruncated: false,
      overdueCards: [],
      todayCards: [],
      pendingCards: [],
      completedCards: [],
      todayAssignedCards: [],
      highPriorityCards: [],
      upcomingCards: [],
      dueThisWeekCards: [],
      dueTomorrowCards: [],
      topDepartments: [],
      employees: [],
    };

    for (const task of activeTasks) {
      companyEntry.stats.totalActive++;
      if (isOverdue(task)) companyEntry.stats.overdue++;
    }

    const totalForRate =
      companyEntry.stats.completedEver + companyEntry.stats.totalActive;
    companyEntry.stats.completionRate =
      totalForRate > 0
        ? Math.round((companyEntry.stats.completedEver / totalForRate) * 100)
        : 0;

    const firstAssigneeId = (task) => {
      const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
      return assignees.length > 0 ? assignees[0] : null;
    };

    for (const task of activeTasks) {
      if (isHighPriority(task) && companyEntry.highPriorityCards.length < maxCards) {
        const assigneeId = firstAssigneeId(task);
        if (assigneeId) {
          companyEntry.highPriorityCards.push(buildCardData(task, companyEntry, assigneeId));
        }
      }
      if (isDueTomorrow(task) && companyEntry.dueTomorrowCards.length < maxCards) {
        const assigneeId = firstAssigneeId(task);
        if (assigneeId) {
          companyEntry.dueTomorrowCards.push(buildCardData(task, companyEntry, assigneeId));
        }
      }
    }

    for (const task of assignedInRange) {
      if (companyEntry.todayAssignedCards.length >= maxCards) break;
      const assigneeId = firstAssigneeId(task);
      if (assigneeId) {
        companyEntry.todayAssignedCards.push(buildCardData(task, companyEntry, assigneeId));
      }
    }

    const deptCounts = new Map();
    for (const task of activeTasks) {
      const dept = (task.department || "").trim();
      if (!dept) continue;
      deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
    }
    companyEntry.topDepartments = [...deptCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // ── 6c. Per-employee table (Super Admin summary) ────────────────────
    // Rows for every active employee (excluding Super Admin), reusing the
    // same in-memory arrays as the company aggregates — no extra task
    // queries. "Total Employees" = count of that employee set (D2 default).
    // Super Admin never appears as a row.
    if (perEmployee) {
      const employeeCounts = new Map();
      const bump = (uid, key) => {
        const uidStr = String(uid);
        const row = employeeCounts.get(uidStr) || {
          totalTasks: 0, overdue: 0, inProgress: 0, completed: 0, assigned: 0,
        };
        row[key]++;
        employeeCounts.set(uidStr, row);
      };
      const forEachAssignee = (tasks, fn) => {
        for (const task of tasks) {
          const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
          for (const assigneeId of assignees) fn(assigneeId);
        }
      };

      forEachAssignee(activeTasks, (assigneeId) => {
        bump(assigneeId, "totalTasks");
      });
      for (const task of activeTasks) {
        const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
        for (const assigneeId of assignees) {
          if (isOverdue(task)) bump(assigneeId, "overdue");
          if (task.status === "In Progress") bump(assigneeId, "inProgress");
        }
      }
      forEachAssignee(completedInRange, (assigneeId) => bump(assigneeId, "completed"));
      forEachAssignee(assignedInRange, (assigneeId) => bump(assigneeId, "assigned"));

      const employees = await User.find({ role: { $ne: "Super Admin" }, isActive: true })
        .select("_id name email")
        .sort({ name: 1 })
        .lean();

      companyEntry.stats.totalEmployees = employees.length;
      companyEntry.employees = employees.map((u) => {
        const c = employeeCounts.get(String(u._id)) || {
          totalTasks: 0, overdue: 0, inProgress: 0, completed: 0, assigned: 0,
        };
        const rateTotal = c.assigned + c.completed;
        return {
          name: u.name,
          email: u.email,
          totalTasks: c.totalTasks,
          completed: c.completed,
          inProgress: c.inProgress,
          overdue: c.overdue,
          completionRate: rateTotal > 0 ? Math.round((c.completed / rateTotal) * 100) : 0,
        };
      });
    }

    return new Map([["company", companyEntry]]);
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
          inProgress: 0,
          assignedInPeriod: 0,
          yesterdayAssignedInPeriod: 0,
          lastWeekAssignedInPeriod: 0,
          lastWeekCompletedInPeriod: 0,
          lastWeekCompletionRate: 0,
          weeklyCompletionRate: 0,
          pendingLastWeek: 0,
          completedInPeriod: 0,
          completedEver: 0,
          completionRate: 0,
          dailyCompletionRate: 0,
          pendingYesterday: 0,
        },
        taskCards: [],
        taskCardsTruncated: false,
        overdueCards: [],
        todayCards: [],
        pendingCards: [],
        inProgressCards: [],
        completedCards: [],
        todayAssignedCards: [],
        highPriorityCards: [],
        upcomingCards: [],
        dueThisWeekCards: [],
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

      if (task.status === "In Progress") {
        entry.stats.inProgress++;
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
      entry.stats.lastWeekCompletedInPeriod++;
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

  // Assigned yesterday — counted per assignee
  for (const task of yesterdayAssignedInRange) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    for (const assigneeId of assignees) {
      const uid = String(assigneeId);
      const entry = initUser(uid);
      entry.stats.yesterdayAssignedInPeriod++;
    }
  }

  // Assigned last week — counted per assignee
  for (const task of lastWeekAssignedInRange) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    for (const assigneeId of assignees) {
      const uid = String(assigneeId);
      const entry = initUser(uid);
      entry.stats.lastWeekAssignedInPeriod++;
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

    // Weekly "Last Week Performance" equivalents — same estimation pattern
    // using the last-week assigned/completed windows. Only populated when
    // the weekly caller supplies last-week windows.
    entry.stats.pendingLastWeek =
      entry.stats.totalActive +
      entry.stats.lastWeekCompletedInPeriod -
      entry.stats.lastWeekAssignedInPeriod;
    if (entry.stats.pendingLastWeek < 0) entry.stats.pendingLastWeek = 0;

    const lastWeekTotal =
      entry.stats.pendingLastWeek + entry.stats.lastWeekCompletedInPeriod;
    entry.stats.lastWeekCompletionRate =
      lastWeekTotal > 0
        ? Math.round((entry.stats.lastWeekCompletedInPeriod / lastWeekTotal) * 100)
        : 0;

    // Weekly "Last Week Performance" — period-based completion rate (D1):
    // completed last week ÷ (assigned last week + completed last week),
    // i.e. how much of last week's workload actually got finished.
    const weeklyPeriodTotal =
      entry.stats.lastWeekAssignedInPeriod + entry.stats.lastWeekCompletedInPeriod;
    entry.stats.weeklyCompletionRate =
      weeklyPeriodTotal > 0
        ? Math.round((entry.stats.lastWeekCompletedInPeriod / weeklyPeriodTotal) * 100)
        : 0;

    // Daily "Yesterday Performance" — period-based completion rate (D1):
    // completed yesterday ÷ (assigned yesterday + completed yesterday),
    // i.e. how much of yesterday's workload actually got finished.
    const dailyPeriodTotal =
      entry.stats.yesterdayAssignedInPeriod + entry.stats.completedInPeriod;
    entry.stats.dailyCompletionRate =
      dailyPeriodTotal > 0
        ? Math.round((entry.stats.completedInPeriod / dailyPeriodTotal) * 100)
        : 0;
  }

  // ── 9. Build task cards, categorized ─────────────────────────────────
  // Categorize into overdueCards, todayCards, pendingCards (up to maxCards total).
  // isDueToday uses IST-based boundaries so deadlines at IST 11:59 PM are
  // correctly attributed to today, and deadlines at IST 12:00 AM to tomorrow.

  // Active task cards — categorized into overdue / due-today / pending,
  // plus derived lists for the daily performance email (high priority,
  // upcoming deadlines). All capped at maxCards per category.
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

      const cardData = buildCardData(task, entry, assigneeId);

      entry.taskCards.push(cardData);

      if (isOverdue(task)) {
        entry.overdueCards.push(cardData);
      } else if (isDueToday(task)) {
        entry.todayCards.push(cardData);
      } else {
        entry.pendingCards.push(cardData);
      }

      if (isHighPriority(task) && entry.highPriorityCards.length < maxCards) {
        entry.highPriorityCards.push(cardData);
      }
      if (isUpcoming(task) && entry.upcomingCards.length < maxCards) {
        entry.upcomingCards.push(cardData);
      }
      if (isDueThisWeek(task) && entry.dueThisWeekCards.length < maxCards) {
        entry.dueThisWeekCards.push(cardData);
      }
      if (task.status === "In Progress" && entry.inProgressCards.length < maxCards) {
        entry.inProgressCards.push(cardData);
      }
    }
  }

  // Completed yesterday — cards for the daily performance email
  for (const task of completedInRange) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    for (const assigneeId of assignees) {
      const uid = String(assigneeId);
      const entry = result.get(uid);
      if (!entry) continue;
      if (entry.completedCards.length >= maxCards) continue;
      entry.completedCards.push(buildCardData(task, entry, assigneeId));
    }
  }

  // Generated today (recurring tasks assigned today) — cards for Section 2
  for (const task of assignedInRange) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    for (const assigneeId of assignees) {
      const uid = String(assigneeId);
      const entry = result.get(uid);
      if (!entry) continue;
      if (entry.todayAssignedCards.length >= maxCards) continue;
      entry.todayAssignedCards.push(buildCardData(task, entry, assigneeId));
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
    entry.inProgressCards.sort(sortByDeadline);
    entry.completedCards.sort(sortByDeadline);
    entry.todayAssignedCards.sort(sortByDeadline);
    entry.highPriorityCards.sort(sortByDeadline);
    entry.upcomingCards.sort(sortByDeadline);
    entry.dueThisWeekCards.sort(sortByDeadline);
  }

  return result;
}
