import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const uri = process.env.MONGODB_URI;
console.log("URI:", uri ? uri.substring(0, 50) + "..." : "NOT FOUND");

try {
  await mongoose.connect(uri, { bufferCommands: false });
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;

  const taskCount = await db.collection("tasks").countDocuments();
  console.log(`\n=== TASKS ===\nTotal: ${taskCount}`);

  const generatedTasks = await db.collection("tasks").find({
    isGeneratedOccurrence: true
  }).project({
    _id: 1, status: 1, isOverdue: 1, deadline: 1,
    isGeneratedOccurrence: 1, occurrenceDate: 1,
    recurrencePattern: 1, taskType: 1, title: 1
  }).toArray();
  console.log(`Generated tasks: ${generatedTasks.length}`);
  for (const t of generatedTasks) {
    console.log(`  [${t._id}] status="${t.status}" isOverdue=${t.isOverdue} occDate=${t.occurrenceDate} type=${t.taskType} rp=${JSON.stringify(t.recurrencePattern)}`);
  }

  const byStatus = await db.collection("tasks").aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]).toArray();
  console.log(`\nBy status:`);
  for (const s of byStatus) console.log(`  ${s._id||"null"}: ${s.count}`);

  const deadlineOverdue = await db.collection("tasks").countDocuments({
    deadline: { $lt: new Date() },
    status: { $nin: ["Completed", "Cancelled"] }
  });
  console.log(`\noverdue=true filter match (deadline<now,not completed/cancelled): ${deadlineOverdue}`);

  const statusOverdueCount = await db.collection("tasks").countDocuments({ status: "Overdue" });
  console.log(`status=Overdue: ${statusOverdueCount}`);

  const recurringNeedCheck = await db.collection("tasks").find({
    status: { $nin: ["Completed", "Cancelled", "Overdue"] },
    isGeneratedOccurrence: true,
    deadline: null,
    occurrenceDate: { $exists: true, $ne: null }
  }).project({ _id: 1, status: 1, occurrenceDate: 1, recurrencePattern: 1, taskType: 1 }).toArray();
  console.log(`\nRecurring tasks needing overdue check: ${recurringNeedCheck.length}`);
  for (const t of recurringNeedCheck) {
    const od = new Date(t.occurrenceDate);
    const now = new Date();
    console.log(`  [${t._id}] status="${t.status}" occDate=${od.toISOString()} epoch=${od.getTime()}`);
    if (t.taskType === "Custom" && t.recurrencePattern) {
      const iv = t.recurrencePattern?.intervalValue ?? t.recurrencePattern?.interval ?? 1;
      const iu = t.recurrencePattern?.intervalUnit || "Days";
      let expiry = new Date(od);
      switch (iu) {
        case "Minutes": expiry = new Date(od.getTime() + iv * 60000); break;
        case "Hours": expiry = new Date(od.getTime() + iv * 3600000); break;
        case "Days": expiry = new Date(od.getTime() + iv * 86400000); break;
        case "Weeks": expiry = new Date(od.getTime() + iv * 604800000); break;
        case "Months": expiry.setMonth(expiry.getMonth() + iv); break;
      }
      console.log(`    interval=${iv} ${iu} expiry=${expiry.toISOString()} now>=expiry=${now >= expiry}`);
    }
  }

  const tmplCount = await db.collection("recurringtemplates").countDocuments();
  console.log(`\n=== TEMPLATES ===\nTotal: ${tmplCount}`);
  const tmpls = await db.collection("recurringtemplates").find({}).toArray();
  for (const t of tmpls) {
    console.log(`  [${t._id}] isActive=${t.isActive} repeatForever=${t.repeatForever} nextGen=${t.nextGenerationDate} genCount=${t.generatedCount}`);
  }

  await mongoose.disconnect();
  console.log("\nDone");
} catch (e) {
  console.error("Error:", e);
  process.exit(1);
}
