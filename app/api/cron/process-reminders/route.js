import { NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  processScheduledEmails,
  sendDeadlineAlerts,
  processOverdueTasks,
  generateRecurringTasks,
} from "../../../../src/utils/cronJobs.js";

export const runtime = "nodejs";

// MongoDB-based distributed lock collection
const LOCK_COLLECTION = "cron_locks";
const LOCK_KEY = "process_reminders";
const LOCK_TTL = 5 * 60 * 1000; // 5 minutes

async function acquireLock() {
  try {
    const db = mongoose.connection.db;
    const locks = db.collection(LOCK_COLLECTION);
    
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + LOCK_TTL);
    
    // Try to acquire lock using findOneAndUpdate with upsert
    // This is atomic - only one execution will succeed
    const result = await locks.findOneAndUpdate(
      { 
        _id: LOCK_KEY,
        $or: [
          { lockedAt: { $exists: false } },
          { lockedAt: { $lt: new Date(now.getTime() - LOCK_TTL) } }
        ]
      },
      { 
        $set: { 
          lockedAt: now,
          expiresAt: lockExpiry 
        },
        $setOnInsert: {
          _id: LOCK_KEY
        }
      },
      { 
        upsert: true,
        returnDocument: 'after'
      }
    );
    
    // Check if we successfully acquired the lock by comparing timestamps
    // If the returned document has our timestamp, we acquired it
    const doc = result && result.value ? result.value : result;
    if (doc && doc.lockedAt && doc.lockedAt.getTime() === now.getTime()) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("[Cron API] Failed to acquire lock:", error);
    return false;
  }
}

async function releaseLock() {
  try {
    const db = mongoose.connection.db;
    const locks = db.collection(LOCK_COLLECTION);
    
    await locks.deleteOne({ _id: LOCK_KEY });
  } catch (error) {
    console.error("[Cron API] Failed to release lock:", error);
  }
}

async function ensureMongoConnection() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  
  return mongoose.connect(process.env.MONGODB_URI, {
    bufferCommands: false,
  });
}

export async function POST(request) {
  // Verify CRON_SECRET authentication
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Ensure MongoDB connection
  await ensureMongoConnection();

  // Acquire distributed lock
  const lockAcquired = await acquireLock();
  
  if (!lockAcquired) {
    return NextResponse.json(
      { success: false, message: "Already processing reminders" },
      { status: 429 }
    );
  }

  try {
    // Run all reminder processing tasks
    await Promise.all([
      processScheduledEmails(),
      sendDeadlineAlerts(),
      processOverdueTasks(),
      generateRecurringTasks(),
    ]);
    
    return NextResponse.json({
      success: true,
      message: "Reminders processed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron API] Failed to process reminders:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  } finally {
    // Always release lock, even on error
    await releaseLock();
  }
}
