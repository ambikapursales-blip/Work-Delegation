/**
 * Migration Script: Add status fields to RecurringTemplate
 *
 * This script adds the new status, pausedAt, pausedBy, deletedAt, deletedBy
 * fields to existing RecurringTemplate documents.
 *
 * Usage: node scripts/migrateMasterTaskStatus.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import RecurringTemplate from "../src/models/RecurringTemplate.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/task-delegation";

async function migrate() {
  try {
    console.log("[Migration] Starting Master Task status migration...");
    console.log("[Migration] Connecting to MongoDB...");

    await mongoose.connect(MONGODB_URI);
    console.log("[Migration] Connected to MongoDB");

    const templates = await RecurringTemplate.find({}).lean();
    console.log(`[Migration] Found ${templates.length} existing templates`);

    let updated = 0;

    for (const template of templates) {
      try {
        const update = {};

        // Set status based on isActive
        if (!template.status) {
          update.status = template.isActive ? "Active" : "Paused";
        }

        if (Object.keys(update).length > 0) {
          await RecurringTemplate.updateOne({ _id: template._id }, { $set: update });
          updated++;
          console.log(`[Migration] Updated template "${template.title}" — status: ${update.status}`);
        }
      } catch (error) {
        console.error(`[Migration] Failed to update template ${template._id}:`, error.message);
      }
    }

    console.log(`[Migration] Updated ${updated} templates with status field`);
    console.log("[Migration] Migration completed successfully!");

    const activeCount = await RecurringTemplate.countDocuments({ status: "Active" });
    const pausedCount = await RecurringTemplate.countDocuments({ status: "Paused" });
    console.log(`[Migration] Active: ${activeCount}, Paused: ${pausedCount}`);
  } catch (error) {
    console.error("[Migration] Fatal error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("[Migration] Disconnected from MongoDB");
  }
}

migrate();