import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { config } from "dotenv";
config();

async function seed() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Write URI to .env.local so Next.js picks it up
  const fs = await import("fs");
  const envLocal = fs.readFileSync(".env.local", "utf8");
  const updated = envLocal
    .split("\n")
    .filter((l) => !l.startsWith("MONGODB_URI="))
    .join("\n")
    .trim();
  fs.writeFileSync(".env.local", `${updated}\nMONGODB_URI=${uri}\n`);

  await mongoose.connect(uri);

  // LOCAL DEVELOPMENT ONLY: bcrypt not needed for plaintext passwords
  // REVERT BEFORE PRODUCTION
  // const bcrypt = await import("bcryptjs");

  // ── Admin User ──
  // const adminPassword = await bcrypt.hash("admin123", 10); // DISABLED FOR LOCAL DEV
  const Admin = (await import("../src/models/User.js")).default;
  const admin = await Admin.create({
    name: "Admin User",
    email: "admin@example.com",
    password: "admin123", // PLAINTEXT FOR LOCAL DEV
    role: "Admin",
    department: "Management",
    isActive: true,
  });

  // ── Manager User ──
  // const managerPassword = await bcrypt.hash("manager123", 10); // DISABLED FOR LOCAL DEV
  const manager = await Admin.create({
    name: "Manager User",
    email: "manager@example.com",
    password: "manager123", // PLAINTEXT FOR LOCAL DEV
    role: "Manager",
    department: "Engineering",
    isActive: true,
  });

  // ── Regular User ──
  // const userPassword = await bcrypt.hash("user123", 10); // DISABLED FOR LOCAL DEV
  const user = await Admin.create({
    name: "Sales User",
    email: "user@example.com",
    password: "user123", // PLAINTEXT FOR LOCAL DEV
    role: "Sales Executive",
    department: "Sales",
    isActive: true,
  });

  // ── Seed Tasks ──
  const Task = (await import("../src/models/Task.js")).default;
  const now = new Date();
  await Task.create([
    {
      title: "Complete Q2 report",
      description: "Compile and submit the quarterly performance report",
      assignedTo: [user._id],
      assignedBy: manager._id,
      priority: "High",
      status: "Pending",
      deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      taskType: "One-time",
    },
    {
      title: "Review team timesheets",
      description: "Approve pending timesheet submissions for the week",
      assignedTo: [manager._id],
      assignedBy: admin._id,
      priority: "Medium",
      status: "In Progress",
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      taskType: "Weekly",
      isRecurring: true,
      recurrencePattern: { frequency: "weekly", interval: 1 },
    },
    {
      title: "Update client database",
      description: "Refresh contact information for top 10 accounts",
      assignedTo: [user._id],
      assignedBy: manager._id,
      priority: "Low",
      status: "Completed",
      deadline: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      taskType: "One-time",
    },
  ]);

  // ── Seed Activity ──
  const Activity = (await import("../src/models/Activity.js")).default;
  await Activity.create([
    {
      user: admin._id,
      type: "login",
      description: "Admin User logged in",
    },
    {
      user: manager._id,
      type: "task_created",
      description: "Manager User created a new task",
    },
    {
      user: user._id,
      type: "task_completed",
      description: "Sales User completed a task",
    },
  ]);
}

seed().catch((err) => {
  process.exit(1);
});
