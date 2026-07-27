/**
 * Migration Script: Backfill deadlines for recurring generated tasks
 *
 * Generated tasks created before the deadline fix have deadline: null.
 * This script calculates and sets the correct deadline for each.
 *
 * Safe to run multiple times (idempotent).
 * Only affects tasks with isGeneratedOccurrence=true, deadline=null,
 * and valid occurrenceDate + recurrencePattern.
 *
 * Usage: node scripts/backfill-recurring-deadlines.mjs
 */

import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getKolkataDateParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function createKolkataDate(year, month, day, hour = 9, minute = 0, second = 0) {
  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  return new Date(utcTimestamp - KOLKATA_OFFSET_MS);
}

function advanceByMonths(taskType, anchorDom, year, month, day, sh, sm) {
  const monthsMap = { Monthly: 1, Quarterly: 3, "Half Yearly": 6, Yearly: 12 };
  const addMonths = monthsMap[taskType] || 1;

  const lastDayThisMonth = new Date(year, month, 0).getDate();
  const targetThisMonth = Math.min(anchorDom, lastDayThisMonth);
  const thisMonthDate = createKolkataDate(year, month, targetThisMonth, sh, sm, 0);

  if (day < targetThisMonth) {
    return thisMonthDate;
  }

  let nextMonth = month + addMonths;
  let nextYear = year;
  while (nextMonth > 12) { nextMonth -= 12; nextYear++; }
  const lastDayNext = new Date(nextYear, nextMonth, 0).getDate();
  const targetNext = Math.min(anchorDom, lastDayNext);
  return createKolkataDate(nextYear, nextMonth, targetNext, sh, sm, 0);
}

function calculateDeadline(occurrenceDate, taskType, recurrencePattern) {
  if (!occurrenceDate || taskType === "One Time") return null;

  const base = new Date(occurrenceDate);

  if (taskType === "Custom") {
    const intervalValue = Number(
      recurrencePattern?.intervalValue ?? recurrencePattern?.interval ?? 1,
    );
    const intervalUnit = recurrencePattern?.intervalUnit || "Days";

    switch (intervalUnit) {
      case "Minutes":
        return new Date(base.getTime() + intervalValue * 60000);
      case "Hours":
        return new Date(base.getTime() + intervalValue * 3600000);
      case "Days":
        return new Date(base.getTime() + intervalValue * 86400000);
      case "Weeks":
        return new Date(base.getTime() + intervalValue * 604800000);
      case "Months": {
        const d = new Date(base);
        d.setMonth(d.getMonth() + intervalValue);
        return d;
      }
      default:
        return new Date(base.getTime() + 86400000);
    }
  }

  switch (taskType) {
    case "Daily":
      return new Date(base.getTime() + 86400000);
    case "Weekly":
      return new Date(base.getTime() + 604800000);
    case "Monthly":
    case "Quarterly":
    case "Half Yearly":
    case "Yearly":
      return null; // Calendar-based monthly+ types need advanceByMonths which requires imports
    default:
      return null;
  }
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found in .env");
  process.exit(1);
}

try {
  await mongoose.connect(uri, { bufferCommands: false });
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const tasks = db.collection("tasks");

  // Find generated tasks without deadlines
  const candidates = await tasks
    .find({
      isGeneratedOccurrence: true,
      deadline: null,
      occurrenceDate: { $exists: true, $ne: null },
    })
    .project({
      _id: 1,
      occurrenceDate: 1,
      taskType: 1,
      recurrencePattern: 1,
    })
    .toArray();

  console.log(`Found ${candidates.length} tasks needing deadline backfill`);

  let updated = 0;
  let skipped = 0;

  for (const task of candidates) {
    const deadline = calculateDeadline(
      task.occurrenceDate,
      task.taskType,
      task.recurrencePattern,
    );

    if (!deadline) {
      // Monthly+ types need full taskGenerationEngine import
      // These will be handled by the main app's cron logic fallback
      skipped++;
      continue;
    }

    await tasks.updateOne(
      { _id: task._id },
      { $set: { deadline } },
    );
    updated++;
  }

  console.log(`Updated ${updated} tasks with calculated deadlines`);
  console.log(`Skipped ${skipped} calendar-based monthly+ tasks (handled by cron fallback)`);

  // Monthly+ types: use advanceByMonths with day-of-month clamping
  // This matches the production engine's calculateDeadline behavior
  const monthTasks = candidates.filter(
    (t) =>
      ["Monthly", "Quarterly", "Half Yearly", "Yearly"].includes(t.taskType) &&
      t.occurrenceDate,
  );

  let monthUpdated = 0;
  for (const task of monthTasks) {
    const base = new Date(task.occurrenceDate);
    const { year, month, day, hour, minute } = getKolkataDateParts(base);
    const deadline = advanceByMonths(task.taskType, day, year, month, day, hour, minute);

    if (deadline && !isNaN(deadline.getTime())) {
      await tasks.updateOne(
        { _id: task._id },
        { $set: { deadline } },
      );
      monthUpdated++;
    }
  }

  console.log(`Updated ${monthUpdated} calendar-based tasks with month-advanced deadlines`);
  console.log(`Total updated: ${updated + monthUpdated}`);

  // Verify
  const remaining = await tasks.countDocuments({
    isGeneratedOccurrence: true,
    deadline: null,
  });
  console.log(`\nRemaining tasks without deadline: ${remaining}`);

  await mongoose.disconnect();
  console.log("\nMigration complete");
} catch (e) {
  console.error("Migration failed:", e);
  process.exit(1);
}
