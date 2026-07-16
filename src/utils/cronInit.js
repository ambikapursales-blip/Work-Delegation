import { initCronJobs } from "./cronJobs.js";

const isVercel =
  process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;

if (!isVercel && !globalThis.__cronInitLogged) {
  globalThis.__cronInitLogged = true;
  console.log("[CronJobs] Initializing cron jobs in development mode...");
  initCronJobs().catch((error) => {
    console.error(
      "[CronJobs] Failed to initialize reminder scheduler:",
      error.message,
      error.stack,
    );
  });
}
