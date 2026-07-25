/**
 * Migration Script: Recurring Tasks to Recurring Templates
 * 
 * This script migrates existing recurring task data from the old Task-based system
 * to the new RecurringTemplate-based system.
 * 
 * IMPORTANT: Run this script after backing up your database.
 * 
 * Usage: node scripts/migrateRecurringToTemplates.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Task from "../src/models/Task.js";
import RecurringTemplate from "../src/models/RecurringTemplate.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/task-delegation";

async function migrate() {
  try {
    console.log("[Migration] Starting migration...");
    console.log("[Migration] Connecting to MongoDB...");

    await mongoose.connect(MONGODB_URI);
    console.log("[Migration] Connected to MongoDB");

    // Phase 1: Find all recurring template tasks (parent tasks)
    console.log("[Migration] Phase 1: Finding recurring template tasks...");
    const templateTasks = await Task.find({
      isRecurring: true,
      parentTaskId: { $exists: false },
    }).lean();

    console.log(`[Migration] Found ${templateTasks.length} recurring template tasks`);

    if (templateTasks.length === 0) {
      console.log("[Migration] No recurring templates found. Migration complete.");
      await mongoose.disconnect();
      return;
    }

    // Phase 2: Create RecurringTemplate documents
    console.log("[Migration] Phase 2: Creating RecurringTemplate documents...");
    const templateIdMap = new Map(); // oldTaskId -> newTemplateId

    for (const task of templateTasks) {
      try {
        // Calculate defaultDeadlineHours from deadline if available
        let defaultDeadlineHours = null;
        if (task.deadline && task.createdAt) {
          const deadline = new Date(task.deadline);
          const created = new Date(task.createdAt);
          const diffHours = (deadline - created) / (1000 * 60 * 60);
          if (diffHours > 0 && diffHours < 1000) {
            defaultDeadlineHours = Math.round(diffHours);
          }
        }

        const templateData = {
          title: task.title,
          description: task.description,
          priority: task.priority,
          department: task.department,
          tags: task.tags,
          assignedTo: task.assignedTo,
          assignedBy: task.assignedBy,
          category: task.category,
          taskType: task.taskType,
          recurrencePattern: task.recurrencePattern,
          isActive: true,
          startDate: task.createdAt,
          endDate: task.recurrenceEndDate || undefined,
          nextGenerationDate: task.nextOccurrenceDate || task.createdAt,
          lastGeneratedDate: task.lastGeneratedDate || undefined,
          generatedCount: 0,
          defaultDeadlineHours,
        };

        const template = await RecurringTemplate.create(templateData);
        templateIdMap.set(task._id.toString(), template._id.toString());
        console.log(`[Migration] Created template: ${template.title} (ID: ${template._id})`);
      } catch (error) {
        console.error(`[Migration] Failed to create template for task ${task._id}:`, error.message);
      }
    }

    console.log(`[Migration] Created ${templateIdMap.size} RecurringTemplate documents`);

    // Phase 3: Update child tasks with templateId
    console.log("[Migration] Phase 3: Updating child tasks with templateId...");
    const childTasks = await Task.find({
      parentTaskId: { $exists: true, $ne: null },
    }).lean();

    console.log(`[Migration] Found ${childTasks.length} child tasks`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const child of childTasks) {
      const parentTaskId = child.parentTaskId.toString();
      const templateId = templateIdMap.get(parentTaskId);

      if (!templateId) {
        console.warn(`[Migration] No template found for parent ${parentTaskId}, skipping child ${child._id}`);
        continue;
      }

      try {
        // Calculate occurrence number based on creation date order
        const siblings = await Task.find({
          parentTaskId: parentTaskId,
        })
          .sort({ createdAt: 1 })
          .lean();

        const occurrenceNumber = siblings.findIndex((s) => s._id.toString() === child._id.toString()) + 1;

        await Task.findByIdAndUpdate(child._id, {
          templateId,
          occurrenceDate: child.createdAt,
          occurrenceNumber,
          generatedAt: child.createdAt,
          generatedByCron: true,
          isGeneratedOccurrence: true,
        });

        updatedCount++;
        console.log(`[Migration] Updated child task: ${child.title} (occurrence #${occurrenceNumber})`);
      } catch (error) {
        console.error(`[Migration] Failed to update child task ${child._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`[Migration] Updated ${updatedCount} child tasks`);
    console.log(`[Migration] Errors: ${errorCount}`);

    // Phase 4: Validation
    console.log("[Migration] Phase 4: Validating migration...");
    const templateCount = await RecurringTemplate.countDocuments();
    const childTaskCount = await Task.countDocuments({ templateId: { $exists: true } });

    console.log(`[Migration] Validation Results:`);
    console.log(`[Migration] - RecurringTemplates: ${templateCount}`);
    console.log(`[Migration] - Tasks with templateId: ${childTaskCount}`);
    console.log(`[Migration] - Original templates: ${templateTasks.length}`);
    console.log(`[Migration] - Original child tasks: ${childTasks.length}`);

    if (templateCount === templateTasks.length && childTaskCount === childTasks.length) {
      console.log("[Migration] ✓ Validation passed - counts match");
    } else {
      console.warn("[Migration] ⚠ Validation warning - counts don't match exactly");
    }

    console.log("[Migration] Migration completed successfully!");
    console.log("[Migration] IMPORTANT: Old Task fields (isRecurring, recurrencePattern, etc.) are preserved for rollback capability.");
    console.log("[Migration] You can safely remove them after verifying the new system works correctly.");

  } catch (error) {
    console.error("[Migration] Fatal error during migration:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("[Migration] Disconnected from MongoDB");
  }
}

// Run migration
migrate();
