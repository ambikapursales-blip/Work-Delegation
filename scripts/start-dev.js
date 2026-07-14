import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log("MongoMemoryServer started at:", uri);

  // Write URI to .env.local
  let envLocal = "";
  try {
    envLocal = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  } catch {
    envLocal = "";
  }
  const lines = envLocal
    .split("\n")
    .filter((l) => !l.trim().startsWith("MONGODB_URI="))
    .filter((l) => l.trim());
  lines.push(`MONGODB_URI=${uri}`);
  fs.writeFileSync(path.join(__dirname, "..", ".env.local"), lines.join("\n") + "\n");
  console.log(".env.local updated with MONGODB_URI");

  // Connect and seed
  await mongoose.connect(uri);
  console.log("Connected to in-memory MongoDB");

  const { default: User } = await import("../src/models/User.js");
  const existing = await User.countDocuments();
  if (existing === 0) {
    console.log("Seeding database...");
    const admin = await User.create({
      name: "Admin User", email: "admin@example.com",
      password: "admin123", role: "Super Admin", department: "Management", isActive: true, canAssignTasks: true, canViewAllTasks: true,
    });
    const manager = await User.create({
      name: "Manager User", email: "manager@example.com",
      password: "manager123", role: "Admin", department: "Engineering", isActive: true, canAssignTasks: true, canViewAllTasks: true,
    });
    await User.create({
      name: "Alok Patel", email: "alokpatel0808@gmail.com",
      password: "Alok123", role: "Admin", department: "Engineering", isActive: true, canAssignTasks: true, canViewAllTasks: true,
    });

    const { default: Task } = await import("../src/models/Task.js");
    const now = new Date();
    await Task.create([
      {
        title: "Complete Q2 report",
        description: "Compile and submit the quarterly performance report",
        assignedTo: [admin._id], assignedBy: manager._id,
        priority: "High", status: "In Progress",
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        taskType: "One Time",
      },
      {
        title: "Review team timesheets",
        assignedTo: [manager._id], assignedBy: admin._id,
        priority: "Medium", status: "In Progress",
        deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        taskType: "Weekly", isRecurring: true,
        recurrencePattern: { frequency: "weekly", interval: 1 },
      },
      {
        title: "Update client database",
        assignedTo: [admin._id], assignedBy: manager._id,
        priority: "Low", status: "Completed",
        deadline: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        taskType: "One Time",
      },
    ]);

    const { default: Activity } = await import("../src/models/Activity.js");
    await Activity.create([
      { user: admin._id, type: "login", description: "System initialized" },
    ]);
    console.log("Database seeded successfully");
  } else {
    console.log(`Database already has ${existing} users, skipping seed`);
  }

  // Start Next.js dev server
  const next = spawn("npx", ["next", "dev", "-p", "3000"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    shell: true,
    env: { ...process.env, MONGODB_URI: uri },
  });

  next.on("close", (code) => {
    console.log("Next.js exited with code", code);
    mongoose.disconnect();
    mongod.stop();
    process.exit(code);
  });

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    mongoose.disconnect();
    mongod.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    mongoose.disconnect();
    mongod.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
