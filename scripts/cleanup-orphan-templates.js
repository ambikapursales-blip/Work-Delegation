/**
 * Find and deactivate RecurringTemplates whose generated tasks no longer exist.
 *
 * Uses Mongoose models (not raw driver) so pre-save hooks fire.
 * Detects orphans by checking if ANY generated occurrence exists for the template.
 *
 * Usage: node scripts/cleanup-orphan-templates.js
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

  const RecurringTemplate = (await import("../src/models/RecurringTemplate.js")).default;
  const Task = (await import("../src/models/Task.js")).default;

  console.log("Connected to MongoDB\n");

  const allTemplates = await RecurringTemplate.find({}).lean();
  console.log(`Templates scanned: ${allTemplates.length}`);

  let orphansFound = 0;
  let orphansDeactivated = 0;
  let validTemplates = 0;

  for (const template of allTemplates) {
    // A template has no generated task if no Task exists with its templateId
    const hasGeneratedTasks = await Task.exists({
      templateId: template._id,
      isGeneratedOccurrence: true,
    });

    if (!hasGeneratedTasks && template.status !== "Deleted") {
      orphansFound++;
      console.log(`  Orphan: ${template._id} — "${template.title}" (taskType: ${template.taskType})`);

      // Use Mongoose model so pre-save hook fires and keeps isActive in sync
      const doc = await RecurringTemplate.findById(template._id);
      if (doc) {
        doc.status = "Deleted";
        doc.deletedAt = new Date();
        await doc.save();
        console.log(`    → Deactivated`);
        orphansDeactivated++;
      }
    } else {
      validTemplates++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Templates scanned:       ${allTemplates.length}`);
  console.log(`  Orphans found:           ${orphansFound}`);
  console.log(`  Orphans deactivated:     ${orphansDeactivated}`);
  console.log(`  Valid/active templates:  ${validTemplates}`);

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
