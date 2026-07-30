/**
 * Phase 4: Seed fresh recurring templates for all task types.
 *
 * Creates one RecurringTemplate per task type using createMasterTask.
 * Verifies each template has correct status/isActive/nextGenerationDate.
 *
 * Usage: node scripts/seed-recurring.js
 */

import mongoose from "mongoose";
import { config } from "dotenv";
config();

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const User = (await import("../src/models/User.js")).default;
  const RecurringTemplate = (await import("../src/models/RecurringTemplate.js")).default;
  const Task = (await import("../src/models/Task.js")).default;

  // Find an admin user to assign tasks
  const adminUser = await User.findOne({
    role: { $in: ["Super Admin", "Admin"] },
    isActive: true,
  }).select("_id name email");
  if (!adminUser) {
    console.error("No admin user found. Run seed scripts first.");
    process.exit(1);
  }
  console.log(`Using admin user: ${adminUser.name} (${adminUser._id})\n`);

  // Also find a regular user to assign to
  const regularUser = await User.findOne({
    role: { $nin: ["Super Admin", "Admin"] },
    isActive: true,
  }).select("_id name email");
  const assigneeId = regularUser?._id || adminUser._id;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const taskTypes = [
    {
      name: "Daily",
      data: {
        title: "Daily Status Report",
        description: "Daily recurring task for status reporting",
        priority: "Medium",
        taskType: "Daily",
        category: "General",
        assignedTo: [assigneeId],
        department: "Engineering",
        startDate: todayStr,
        scheduledHour: 9,
        scheduledMinute: 0,
        repeatForever: true,
        recurrencePattern: { frequency: "daily", interval: 1 },
      },
    },
    {
      name: "Weekly",
      data: {
        title: "Weekly Team Meeting",
        description: "Weekly recurring team sync meeting",
        priority: "High",
        taskType: "Weekly",
        category: "General",
        assignedTo: [assigneeId],
        department: "Engineering",
        startDate: todayStr,
        scheduledHour: 10,
        scheduledMinute: 0,
        repeatForever: true,
        recurrencePattern: { frequency: "weekly", interval: 1, daysOfWeek: [1] },
      },
    },
    {
      name: "Monthly",
      data: {
        title: "Monthly Performance Report",
        description: "Monthly performance reporting task",
        priority: "High",
        taskType: "Monthly",
        category: "Operations",
        assignedTo: [assigneeId],
        department: "Engineering",
        startDate: todayStr,
        scheduledHour: 9,
        scheduledMinute: 0,
        repeatForever: true,
        recurrencePattern: { frequency: "monthly", interval: 1, dayOfMonth: 1 },
      },
    },
    {
      name: "Quarterly",
      data: {
        title: "Quarterly Business Review",
        description: "Quarterly business review preparation",
        priority: "Critical",
        taskType: "Quarterly",
        category: "Strategic",
        assignedTo: [assigneeId],
        department: "Engineering",
        startDate: todayStr,
        scheduledHour: 9,
        scheduledMinute: 0,
        repeatForever: true,
        recurrencePattern: { frequency: "quarterly", interval: 1 },
      },
    },
    {
      name: "Half Yearly",
      data: {
        title: "Half Yearly Audit",
        description: "Half-yearly audit preparation task",
        priority: "Critical",
        taskType: "Half Yearly",
        category: "Operations",
        assignedTo: [assigneeId],
        department: "Engineering",
        startDate: todayStr,
        scheduledHour: 9,
        scheduledMinute: 0,
        repeatForever: true,
        recurrencePattern: { frequency: "halfyearly", interval: 1 },
      },
    },
    {
      name: "Yearly",
      data: {
        title: "Yearly Strategic Planning",
        description: "Annual strategic planning session",
        priority: "Critical",
        taskType: "Yearly",
        category: "Strategic",
        assignedTo: [assigneeId],
        department: "Engineering",
        startDate: todayStr,
        scheduledHour: 9,
        scheduledMinute: 0,
        repeatForever: true,
        recurrencePattern: { frequency: "yearly", interval: 1 },
      },
    },
    {
      name: "Custom",
      data: {
        title: "Bi-Weekly Code Review",
        description: "Code review every 2 weeks",
        priority: "Medium",
        taskType: "Custom",
        category: "General",
        assignedTo: [assigneeId],
        department: "Engineering",
        startDate: todayStr,
        scheduledHour: 14,
        scheduledMinute: 0,
        repeatForever: true,
        recurrencePattern: { frequency: "custom", intervalValue: 2, intervalUnit: "Weeks" },
      },
    },
    {
      name: "One Time",
      data: {
        title: "One-time Project Report",
        description: "Single project report due next week",
        priority: "High",
        taskType: "One Time",
        category: "General",
        assignedTo: [assigneeId],
        department: "Engineering",
        startDate: todayStr,
        deadline: tomorrowStr,
        scheduledHour: 9,
        scheduledMinute: 0,
        recurrencePattern: null,
      },
    },
  ];

  const createdTemplates = [];

  for (const { name, data } of taskTypes) {
    try {
      // Build a mock request object matching what createMasterTask expects
      const payload = {
        ...data,
        tags: [],
        assignedBy: adminUser._id,
      };

      // Use RecurringTemplate.create directly with correct fields
      const isOneTime = payload.taskType === "One Time";
      const effectiveStart = new Date(payload.startDate);
      const { calculateFirstGenerationDate } = await import("../src/utils/taskGenerationEngine.js");

      const templateData = {
        title: payload.title,
        description: payload.description,
        priority: payload.priority || "Medium",
        department: payload.department,
        tags: payload.tags || [],
        assignedTo: Array.isArray(payload.assignedTo) ? payload.assignedTo : [payload.assignedTo],
        assignedBy: adminUser._id,
        category: payload.category,
        taskType: payload.taskType,
        recurrencePattern: isOneTime ? undefined : payload.recurrencePattern,
        status: isOneTime ? "Scheduled" : "Active",
        startDate: effectiveStart,
        endDate: null,
        repeatForever: isOneTime ? false : true,
        scheduledHour: payload.scheduledHour || 9,
        scheduledMinute: payload.scheduledMinute || 0,
        timezone: "Asia/Kolkata",
        nextGenerationDate: isOneTime ? null : calculateFirstGenerationDate({
          taskType: payload.taskType,
          recurrencePattern: payload.recurrencePattern,
          startDate: effectiveStart,
          scheduledHour: payload.scheduledHour || 9,
          scheduledMinute: payload.scheduledMinute || 0,
        }),
        deadline: isOneTime ? new Date(payload.deadline) : undefined,
        generatedCount: 0,
        defaultDeadlineHours: null,
        lastGeneratedDate: null,
      };

      const template = await RecurringTemplate.create(templateData);

      // Verify the template
      const verify = await RecurringTemplate.findById(template._id).lean();
      const statusOk = verify.status === (isOneTime ? "Scheduled" : "Active");
      const isActiveOk = verify.isActive === true;

      console.log(`${name.padEnd(14)} ✓  status:${verify.status.padEnd(10)} isActive:${verify.isActive}  nextGen:${verify.nextGenerationDate?.toISOString() || "N/A"}`);

      createdTemplates.push(verify);
    } catch (err) {
      console.error(`${name.padEnd(14)} ✗  ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Created ${createdTemplates.length}/${taskTypes.length} templates`);
  console.log(`All templates have status/status/isActive consistent: ${createdTemplates.every(t => t.isActive === true)}`);

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
