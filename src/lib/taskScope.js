export async function getTaskScopeFilter(user) {
  if (user.role === "Super Admin" || user.canViewAllTasks) {
    return {};
  }

  return { assignedTo: user._id };
}

export async function getScopeFilter(user, fieldName, options = {}) {
  if (user.role === "Super Admin" || user.canViewAllTasks) {
    return {};
  }

  return { [fieldName]: user._id };
}
