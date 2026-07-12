import Activity from "@/src/models/Activity";
import Task from "@/src/models/Task";
import User from "@/src/models/User";

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        timeZone: "UTC",
      })
    : "Unknown";
}

export async function processExtensionResponse(taskId, requestId, action) {
  const task = await Task.findById(taskId);
  if (!task) return { success: false, message: "Task not found" };

  const extRequest = task.extensionRequests.id(requestId);
  if (!extRequest) return { success: false, message: "Extension request not found" };
  if (extRequest.status !== "pending") {
    return { success: true, message: `This request has already been ${extRequest.status}` };
  }

  const revisedDateStr = fmtDate(extRequest.revisedTargetDate);

  extRequest.status = action;
  extRequest.respondedAt = new Date();

  if (action === "approved") {
    task.deadline = extRequest.revisedTargetDate;
    task.history.push({
      status: task.status,
      changedBy: task.assignedBy,
      changedAt: new Date(),
      note: `Revised target date of ${revisedDateStr} approved`,
    });
  } else {
    task.history.push({
      status: task.status,
      changedBy: task.assignedBy,
      changedAt: new Date(),
      note: `Revised target date request for ${revisedDateStr} rejected`,
    });
  }

  await task.save();

  const assigner = await User.findById(task.assignedBy).select("name").lean();
  await Activity.create({
    user: task.assignedBy,
    type: "task_updated",
    description: `${assigner?.name || "Manager"} ${action} revised target date request for task "${task.title}"`,
    entityId: task._id,
    entityType: "Task",
  });

  return { success: true, message: action === "approved" ? `Revised target date of ${revisedDateStr} has been approved.` : `Revised target date request for ${revisedDateStr} has been rejected.` };
}
