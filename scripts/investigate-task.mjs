import mongoose from "mongoose";

const uri = "mongodb+srv://dme_db_user:Deepsikha123@cluster0.oumqefs.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // Find all Custom tasks
  const customTasks = await db.collection("tasks").find({ taskType: "Custom" }).toArray();
  console.log("=== ALL Custom tasks ===");
  console.log(`Found ${customTasks.length} Custom task(s)\n`);

  for (const t of customTasks) {
    console.log(`--- Task: ${t._id} ---`);
    console.log("title:", t.title);
    console.log("taskType:", JSON.stringify(t.taskType));
    console.log("status:", JSON.stringify(t.status));
    console.log("createdAt:", t.createdAt);
    console.log("recurrencePattern:", JSON.stringify(t.recurrencePattern, null, 2));
    console.log("reminderState:", JSON.stringify(t.reminderState, null, 2));
    console.log("");
  }

  // Also check for any task with recurrencePattern
  const withRP = await db.collection("tasks").find({ recurrencePattern: { $exists: true, $ne: null } }).toArray();
  console.log(`=== Tasks with recurrencePattern: ${withRP.length} ===`);
  for (const t of withRP) {
    console.log(`--- ${t._id} ---`);
    console.log("title:", t.title);
    console.log("taskType:", t.taskType);
    console.log("recurrencePattern:", JSON.stringify(t.recurrencePattern));
    console.log("");
  }

  // Check all unique taskTypes
  const types = await db.collection("tasks").distinct("taskType");
  console.log("=== All distinct task types ===", types);

  await mongoose.disconnect();
}

main().catch(console.error);
