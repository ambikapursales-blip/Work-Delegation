import User from "@/src/models/User";

/**
 * Get team member IDs for a Manager.
 * @param {ObjectId} managerId
 * @returns {Promise<ObjectId[]>}
 */
async function getTeamMemberIds(managerId) {
  const members = await User.find({ managerId }).select("_id").lean();
  return members.map((m) => m._id);
}

/**
 * Centralized scope filter for Task queries.
 *
 * Business rules:
 * - Super Admin → no filter (all tasks)
 * - canViewAllTasks=true → no filter (all tasks)
 * - Manager → tasks assigned to team members OR assigned by self
 * - All other users → tasks assigned to self only
 *
 * @param {Object} user - req.user (must have role, canViewAllTasks, _id)
 * @returns {Promise<Object>} MongoDB query filter object
 */
export async function getTaskScopeFilter(user) {
  if (user.role === "Super Admin" || user.canViewAllTasks) {
    return {};
  }

  if (user.role === "Manager") {
    const teamIds = await getTeamMemberIds(user._id);
    teamIds.push(user._id);
    return {
      $or: [
        { assignedTo: { $in: teamIds } },
        { assignedBy: user._id },
      ],
    };
  }

  return { assignedTo: user._id };
}

/**
 * Centralized scope filter for generic entity queries (DWR, Attendance, Activity, User).
 *
 * Business rules:
 * - Super Admin → no filter (all records)
 * - canViewAllTasks=true → no filter (all records)
 * - Manager → records belonging to team members
 * - All other users → own records only
 *
 * @param {Object} user - req.user (must have role, canViewAllTasks, _id)
 * @param {string} fieldName - MongoDB field to filter on (e.g. "employee", "user", "_id")
 * @param {Object} [options]
 * @param {boolean} [options.includeSelf=false] - include user's own ID in Manager's team scope
 * @returns {Promise<Object>} MongoDB query filter object
 */
export async function getScopeFilter(user, fieldName, options = {}) {
  if (user.role === "Super Admin" || user.canViewAllTasks) {
    return {};
  }

  if (user.role === "Manager") {
    const teamIds = await getTeamMemberIds(user._id);
    if (options.includeSelf) teamIds.push(user._id);
    return { [fieldName]: { $in: teamIds } };
  }

  return { [fieldName]: user._id };
}
