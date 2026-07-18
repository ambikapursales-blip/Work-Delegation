import mongoose from "mongoose";

const uri = "mongodb+srv://Alok:XRDx51zx8gdOChih@cluster0.k36rexu.mongodb.net/work-delegation?retryWrites=true&w=majority&appName=Cluster0";
const superAdminId = "6a51de5ff0320e0f3c4088b0";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // Find tasks where Super Admin is NOT assigned and NOT the creator
  const tasks = await db
    .collection("tasks")
    .find({
      status: "In Progress",
      assignedTo: { $nin: [new mongoose.Types.ObjectId(superAdminId)] },
      assignedBy: { $ne: new mongoose.Types.ObjectId(superAdminId) },
    })
    .toArray();

  console.log("=== Tasks SA is NOT assigned to and did NOT create ===");
  console.log("Count:", tasks.length);
  for (const t of tasks) {
    console.log("_id:", t._id.toString());
    console.log("  title:", t.title);
    console.log("  assignedBy:", t.assignedBy?.toString());
    console.log("  assignedTo:", t.assignedTo?.map((a) => a.toString()));
    console.log(
      "  assigneeProgress:",
      JSON.stringify(
        t.assigneeProgress?.map((p) => ({
          user: p.user?.toString(),
          status: p.status,
        })),
      ),
    );
    console.log("---");
  }

  // If we found one, also get full data with reminderState
  if (tasks.length > 0) {
    const t = tasks[0];
    const fullTask = await db
      .collection("tasks")
      .findOne({ _id: t._id });
    console.log("\n=== FULL TASK DATA ===");
    console.log("reminderState:", JSON.stringify(fullTask.reminderState?.map(r => ({
      user: r.user?.toString(),
      isPaused: r.isPaused,
      lastReminderType: r.lastReminderType
    }))));
    console.log("history:", JSON.stringify(fullTask.history));
  }

  await mongoose.disconnect();
}

main().catch(console.error);
