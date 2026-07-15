export async function register() {
  try {
    const { initCronJobs } = await import("./src/utils/cronJobs.js");
    await initCronJobs();
  } catch (error) {
    console.error(
      "[CronJobs] Failed to initialize reminder scheduler:",
      error.message,
    );
  }
}
