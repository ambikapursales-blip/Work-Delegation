/**
 * DEEP RUNTIME INVESTIGATION — TRACES processScheduledEmails() FOR THE CUSTOM TASK
 */
const mongoose = require("mongoose");
const uri = "mongodb+srv://dme_db_user:Deepsikha123@cluster0.oumqefs.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const task = await db.collection("tasks").findOne({ taskType: "Custom" });
  if (!task) { console.log("ERROR: No Custom task found."); await mongoose.disconnect(); return; }

  const NOW = new Date();
  const rs = task.reminderState?.[0];
  if (!rs) { console.log("FATAL: no reminderState[0]"); await mongoose.disconnect(); return; }

  const lock = rs.lockUntil ? new Date(rs.lockUntil) : null;
  const next = rs.nextReminderAt ? new Date(rs.nextReminderAt) : null;
  const assigneeProgress = task.assigneeProgress?.[0];

  console.log("================================================================");
  console.log("INVESTIGATION REPORT: Custom task execution trace");
  console.log("================================================================");
  console.log("");

  console.log("--- EXACT MONGODB DOCUMENT ---");
  console.log("_id:", task._id.toString());
  console.log("title:", task.title);
  console.log("taskType:", JSON.stringify(task.taskType));
  console.log("status:", JSON.stringify(task.status));
  console.log("");
  console.log("recurrencePattern:", JSON.stringify(task.recurrencePattern));
  console.log("");
  console.log("reminderState[0]:");
  console.log("  nextReminderAt:", rs.nextReminderAt);
  console.log("  lastReminderAt:", rs.lastReminderAt);
  console.log("  lockUntil:", rs.lockUntil);
  console.log("  isPaused:", JSON.stringify(rs.isPaused));
  console.log("  reminderCount:", rs.reminderCount);
  console.log("  user:", rs.user?.toString() || rs.user);
  console.log("");
  console.log("assigneeProgress[0]:");
  console.log("  user:", assigneeProgress?.user?.toString());
  console.log("  status:", JSON.stringify(assigneeProgress?.status));
  console.log("");

  console.log("--- CURRENT TIME ---");
  console.log("UTC:", NOW.toISOString());
  console.log("Local:", NOW.toString());
  console.log("UNIX ms:", NOW.getTime());
  console.log("");

  // =================================================================
  // TRACE processScheduledEmails()
  // =================================================================
  console.log("================================================================");
  console.log("STEP 1 — Task.find() query");
  console.log("================================");
  console.log("Query: { status: { $nin: ['Completed', 'Cancelled'] } }");
  console.log("task.status:", JSON.stringify(task.status));
  const passesFind = !["Completed", "Cancelled"].includes(task.status);
  console.log("Included by query:", passesFind ? "YES" : "NO (task excluded)");
  if (!passesFind) { console.log(">>> STOP: task not in result set"); await mongoose.disconnect(); return; }
  console.log("");

  console.log("================================================================");
  console.log("STEP 2 — Assignee loop entered");
  console.log("================================");
  const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo].filter(Boolean);
  console.log("Assignee count:", assignees.length);
  if (assignees.length === 0) { console.log(">>> STOP: no assignees"); await mongoose.disconnect(); return; }
  const aId = assignees[0]?.toString?.() || String(assignees[0]);
  console.log("Assignee:", aId);
  console.log("");

  // ensureReminderState
  console.log("--- ensureReminderState() ---");
  const existing = task.reminderState?.find(e => e?.user?.toString() === aId);
  console.log("Existing entry found:", existing ? "YES" : "NO (would create new)");
  if (existing) console.log("  → returns existing entry, no DB modification");
  else console.log("  → would create new reminderState entry");
  const reminderState = existing;
  console.log("");

  // getReminderMode
  console.log("--- getReminderMode() ---");
  const deadline = task.deadline ? new Date(task.deadline) : null;
  let mode;
  if (["Completed", "Cancelled"].includes(task.status)) mode = "stopped";
  else if (deadline && NOW > deadline) mode = "overdue";
  else mode = "normal";
  console.log("Mode:", JSON.stringify(mode));
  console.log("");

  // shouldSendReminder — EVERY CONDITION
  console.log("================================================================");
  console.log("STEP 3 — shouldSendReminder() — ALL CONDITIONS EVALUATED");
  console.log("================================");
  console.log("");

  const conditions = [];

  // A: line 259
  console.log("--- Condition A (reminderEngine.js:259) ---");
  console.log("  Expression: !reminderState || reminderState.isPaused");
  const condA = !reminderState || reminderState.isPaused;
  console.log("  !reminderState:", !reminderState);
  console.log("  reminderState.isPaused:", JSON.stringify(reminderState?.isPaused));
  console.log("  Result:", condA ? "TRUE → return false at line 260" : "FALSE → continue");
  conditions.push({label: "A: !reminderState || isPaused", line: "260", result: condA ? "EXIT" : "PASS", value: true});
  if (condA) { console.log("\n>>> FIRST EXIT at line 260"); }
  console.log("");

  // B: line 263
  console.log("--- Condition B (reminderEngine.js:263) ---");
  console.log("  Expression: task.status === 'Completed' || task.status === 'Cancelled'");
  const condB = task.status === "Completed" || task.status === "Cancelled";
  console.log("  task.status:", JSON.stringify(task.status));
  console.log("  Result:", condB ? "TRUE → return false at line 264" : "FALSE → continue");
  conditions.push({label: "B: status Completed/Cancelled", line: "264", result: condB ? "EXIT" : "PASS", value: condB});
  if (condB) { console.log("\n>>> FIRST EXIT at line 264"); }
  console.log("");

  // C: line 269
  console.log("--- Condition C (reminderEngine.js:269) ---");
  console.log("  Expression: lockUntil && current < lockUntil");
  console.log("  lockUntil (raw from DB):", JSON.stringify(rs.lockUntil));
  console.log("  lockUntil (Date):", lock ? lock.toISOString() : null);
  console.log("  lockUntil exists:", !!lock);
  console.log("  current:", NOW.toISOString());
  console.log("  current < lockUntil:", lock ? (NOW < lock) : "N/A (no lock)");
  const condC = !!(lock && NOW < lock);
  console.log("  Result:", condC ? "TRUE → return false at line 270" : "FALSE → continue");
  conditions.push({label: "C: lockUntil active", line: "270", result: condC ? "EXIT" : "PASS", value: condC});
  if (condC && !condA && !condB) { console.log("\n>>> FIRST EXIT at line 270"); }
  console.log("");

  // D: line 276
  console.log("--- Condition D (reminderEngine.js:276) ---");
  console.log("  Expression: assigneeProgress entry exists with status 'Completed'");
  const matchedProgress = (task.assigneeProgress || []).find(
    e => e?.user?.toString() === reminderState?.user?.toString()
  );
  console.log("  Matching assigneeProgress entry found:", !!matchedProgress);
  console.log("  assigneeProgress.status:", JSON.stringify(matchedProgress?.status));
  const condD = matchedProgress?.status === "Completed";
  console.log("  Result:", condD ? "TRUE → return false at line 277" : "FALSE → continue");
  conditions.push({label: "D: assigneeProgress Completed", line: "277", result: condD ? "EXIT" : "PASS", value: condD});
  if (condD && !condA && !condB && !condC) { console.log("\n>>> FIRST EXIT at line 277"); }
  console.log("");

  // E: line 280
  console.log("--- Condition E (reminderEngine.js:280) ---");
  console.log("  Expression: !reminderState.nextReminderAt");
  console.log("  nextReminderAt (raw from DB):", JSON.stringify(rs.nextReminderAt));
  console.log("  !nextReminderAt:", !rs.nextReminderAt);
  const condE = !rs.nextReminderAt;
  console.log("  Result:", condE ? "TRUE → return false at line 281" : "FALSE → continue");
  conditions.push({label: "E: !nextReminderAt", line: "281", result: condE ? "EXIT" : "PASS", value: condE});
  if (condE && !condA && !condB && !condC && !condD) { console.log("\n>>> FIRST EXIT at line 281"); }
  console.log("");

  // F: line 285
  console.log("--- Condition F (reminderEngine.js:285) ---");
  console.log("  Expression: current >= nextReminderAt");
  console.log("  nextReminderAt (Date):", next ? next.toISOString() : null);
  console.log("  current:", NOW.toISOString());
  console.log("  current.getTime():", NOW.getTime());
  console.log("  next.getTime():", next ? next.getTime() : null);
  console.log("  diff (ms):", next ? (NOW.getTime() - next.getTime()) : null);
  console.log("  current >= next?:", next ? (NOW >= next) : "N/A (next is null)");
  const condF = next ? NOW >= next : false;
  console.log("  Result:", condF ? "TRUE → should send!" : "FALSE → return false at line 285");
  conditions.push({label: "F: current >= nextReminderAt", line: "285", result: condF ? "SEND" : "EXIT", value: condF});
  if (!condF && !condA && !condB && !condC && !condD && !condE) { console.log("\n>>> FIRST EXIT at line 285"); }
  console.log("");

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log("================================================================");
  console.log("FINAL SUMMARY");
  console.log("================================");
  console.log("");

  let firstExit = null;
  for (const c of conditions) {
    const arrow = c.result === "EXIT" ? " <<< EXIT HERE" : "";
    console.log(`  ${c.label.padEnd(35)} ${c.result.padEnd(6)}${arrow}`);
    if (!firstExit && c.result === "EXIT") firstExit = c;
  }
  console.log("");

  if (firstExit) {
    console.log("FIRST condition that returns false:", firstExit.label);
    console.log("File: src/utils/reminderEngine.js");
    console.log("Line:", firstExit.line);
    console.log("");
    console.log("Exact return statement:");
    console.log(`  reminderEngine.js:${firstExit.line}  return false;`);
  }

  console.log("");
  console.log("================================================================");
  console.log("WHY processedCount == 0");
  console.log("================================");
  console.log("");
  console.log("  processedCount is declared at cronJobs.js:341");
  console.log("    let processedCount = 0;");
  console.log("  It is incremented at cronJobs.js:397");
  console.log("    processedCount++;");
  console.log("  This line is inside the if (shouldSend) block at cronJobs.js:353-356.");
  console.log("  Since shouldSendReminder() returns false at line", firstExit?.line || "???", ",");
  console.log("  the increment NEVER executes.");
  console.log("  processedCount remains 0 throughout the function.");
  console.log("  The log at cronJobs.js:411 prints:");
  console.log("    console.log(`[CronJobs] Processed ${processedCount} reminder emails`);");
  console.log("    → \"[CronJobs] Processed 0 reminder emails\"");
  console.log("");

  console.log("================================================================");
  console.log("EXACT VALUES TABLE");
  console.log("================================");
  console.log("");
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("Field", 32), "|", pad("Value", 32));
  console.log("-".repeat(67));
  console.log(pad("currentTime (UTC)", 32), "|", NOW.toISOString());
  console.log(pad("currentTime (local)", 32), "|", NOW.toString());
  console.log(pad("taskType", 32), "|", JSON.stringify(task.taskType));
  console.log(pad("task.status", 32), "|", JSON.stringify(task.status));
  console.log(pad("reminderState exists", 32), "|", !!reminderState);
  console.log(pad("reminderState.isPaused", 32), "|", JSON.stringify(reminderState?.isPaused));
  console.log(pad("reminderState.lockUntil", 32), "|", lock ? lock.toISOString() : "null");
  console.log(pad("reminderState.nextReminderAt", 32), "|", next ? next.toISOString() : "null");
  console.log(pad("reminderState.lastReminderAt", 32), "|", rs.lastReminderAt ? new Date(rs.lastReminderAt).toISOString() : "null");
  console.log(pad("reminderState.reminderCount", 32), "|", rs.reminderCount);
  console.log(pad("assigneeProgress.status", 32), "|", JSON.stringify(assigneeProgress?.status));
  console.log(pad("lockUntil > currentTime", 32), "|", lock ? (lock > NOW) : "N/A");
  console.log(pad("nextReminderAt > currentTime", 32), "|", next ? (next > NOW) : "N/A");
  console.log(pad("shouldSendReminder() returns", 32), "|", "false");
  console.log(pad("First failing line", 32), "|", "reminderEngine.js:" + firstExit?.line);
  console.log("");

  const isLockBlocking = lock && NOW < lock;
  const isNextBlocking = next && NOW < next;
  console.log("SUMMARY: The task is ", isLockBlocking && isNextBlocking ? "DOUBLE-BLOCKED:" : "", sep="");
  if (isLockBlocking) console.log("  1. Lock debounce active — lockUntil (" + lock.toISOString() + ") > currentTime (" + NOW.toISOString() + ")");
  if (isNextBlocking) console.log("  2. Not yet time — nextReminderAt (" + next.toISOString() + ") > currentTime (" + NOW.toISOString() + ")");
  if (!isLockBlocking && !isNextBlocking) console.log("  READY TO SEND — should be processed on next cron tick");

  await mongoose.disconnect();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
