/**
 * Phase 3: Clean all dummy recurring data from the database.
 *
 * Deletes:
 *   - All RecurringTemplate documents
 *   - All generated Task occurrences (isGeneratedOccurrence: true)
 *   - All orphan Notifications, Activities, Messages, Conversations
 *     linked to generated tasks or templates
 *
 * Preserves:
 *   - All User accounts, roles, permissions
 *   - All non-generated Tasks (regular one-off tasks)
 *   - All application settings and configuration
 *
 * Usage: node scripts/cleanup-all-recurring.js
 */

import mongoose from "mongoose";
import { config } from "dotenv";
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not found in environment");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const RecurringTemplate = (await import("../src/models/RecurringTemplate.js")).default;
  const Task = (await import("../src/models/Task.js")).default;
  const Activity = (await import("../src/models/Activity.js")).default;
  const Notification = (await import("../src/models/Notification.js")).default;
  const Message = (await import("../src/models/Message.js")).default;
  const Conversation = (await import("../src/models/Conversation.js")).default;

  // Phase 3a: Delete all generated task occurrences
  const generatedTaskResult = await Task.deleteMany({ isGeneratedOccurrence: true });
  console.log(`Deleted ${generatedTaskResult.deletedCount} generated task occurrences`);

  // Phase 3b: Collect IDs of all non-generated tasks (to preserve them)
  const nonGeneratedTaskIds = await Task.distinct("_id", {
    $or: [
      { isGeneratedOccurrence: { $ne: true } },
      { isGeneratedOccurrence: { $exists: false } },
    ],
  });
  console.log(`Preserving ${nonGeneratedTaskIds.length} non-generated tasks`);

  // Phase 3c: Delete all RecurringTemplate documents
  const templateResult = await RecurringTemplate.deleteMany({});
  console.log(`Deleted ${templateResult.deletedCount} recurring templates`);

  // Phase 3d: Clean up associated data for generated tasks
  // Delete activities where entityType is "RecurringTemplate" (all template activities)
  const templateActivityResult = await Activity.deleteMany({ entityType: "RecurringTemplate" });
  console.log(`Deleted ${templateActivityResult.deletedCount} template-related activities`);

  // Delete activities for generated tasks (using the preserved task IDs)
  const activityResult = await Activity.deleteMany({
    entityType: "Task",
    entityId: { $nin: nonGeneratedTaskIds },
  });
  console.log(`Deleted ${activityResult.deletedCount} generated-task-related activities`);

  // Delete notifications for generated tasks
  const notificationResult = await Notification.deleteMany({
    entityType: "Task",
    entityId: { $nin: nonGeneratedTaskIds },
  });
  console.log(`Deleted ${notificationResult.deletedCount} generated-task notifications`);

  // Delete messages for generated tasks
  const messageResult = await Message.deleteMany({
    taskId: { $nin: nonGeneratedTaskIds },
  });
  console.log(`Deleted ${messageResult.deletedCount} generated-task messages`);

  // Delete conversations for generated tasks
  const conversationResult = await Conversation.deleteMany({
    taskId: { $nin: nonGeneratedTaskIds },
  });
  console.log(`Deleted ${conversationResult.deletedCount} generated-task conversations`);

  console.log("\n=== Cleanup Complete ===");
  console.log("RecurringTemplates:      All deleted");
  console.log("Generated tasks:         All deleted");
  console.log("Non-generated tasks:     Preserved");
  console.log("User accounts:           Preserved");
  console.log("Template/generated data: Cleaned up\n");

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
