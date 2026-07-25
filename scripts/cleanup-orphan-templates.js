/**
 * One-time migration script: find and deactivate RecurringTemplates
 * whose master recurring task no longer exists.
 *
 * Usage: node scripts/cleanup-orphan-templates.js
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

// Read MONGODB_URI from .env
const envPath = path.join(__dirname, "..", ".env");
let URI = process.env.MONGODB_URI;

if (!URI && fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  const match = env.match(/MONGODB_URI=["']?([^"'\n]+)/);
  if (match) URI = match[1].trim();
}

if (!URI) {
  console.error("MONGODB_URI not found in environment or .env");
  process.exit(1);
}

async function main() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;

  console.log("Connected to MongoDB\n");

  const allTemplates = await db.collection("recurringtemplates").find({}).toArray();
  console.log(`Templates scanned: ${allTemplates.length}`);

  let orphansFound = 0;
  let orphansDeleted = 0;
  let validTemplates = 0;

  for (const template of allTemplates) {
    const masterTask = await db.collection("tasks").findOne({
      templateId: template._id,
      isRecurring: true,
    });

    if (!masterTask) {
      orphansFound++;
      console.log(`  Orphan: ${template._id} — "${template.title}" (taskType: ${template.taskType})`);

      await db.collection("recurringtemplates").updateOne(
        { _id: template._id },
        { $set: { isActive: false } },
      );
      console.log(`    → Deactivated`);
      orphansDeleted++;
    } else {
      validTemplates++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Templates scanned:  ${allTemplates.length}`);
  console.log(`  Orphans found:      ${orphansFound}`);
  console.log(`  Orphans deactivated: ${orphansDeleted}`);
  console.log(`  Valid templates:    ${validTemplates}`);

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
