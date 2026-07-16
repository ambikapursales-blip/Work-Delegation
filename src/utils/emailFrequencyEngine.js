/**
 * Email Frequency Engine
 *
 * Handles scheduling logic for task-based email notifications based on task type.
 * This engine calculates when the next email should be sent for each task type.
 * All dates are calculated in Indian Standard Time (Asia/Kolkata).
 *
 * Task Types:
 * - One Time: Email only once when task is assigned
 * - Daily: Email every day until completed
 * - Weekly: Every 7 days
 * - Monthly: Every month
 * - Quarterly: Every 3 months
 * - Half Yearly: Every 6 months
 * - Yearly: Every 12 months
 */

const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getKolkataDateParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function createKolkataDate(
  year,
  month,
  day,
  hour = 10,
  minute = 0,
  second = 0,
) {
  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  return new Date(utcTimestamp - KOLKATA_OFFSET_MS);
}

/**
 * Calculate the next email schedule date based on task type and current date
 * @param {string} taskType - The type of task (One Time, Daily, Weekly, Monthly, Quarterly, Half Yearly, Yearly)
 * @param {Date} baseDate - The base date to calculate from (usually task assignment date or last email date)
 * @returns {Date|null} - The next scheduled email date, or null if no further emails needed
 */
export function calculateNextEmailDate(taskType, baseDate = new Date()) {
  if (!taskType || !baseDate) return null;

  const current = new Date(baseDate);
  const { year, month, day } = getKolkataDateParts(current);
  
  switch (taskType) {
    case "One Time":
      // One Time tasks only get one email on assignment, no future emails
      return null;
    
    case "Daily":
      // Email every day at 10 AM IST
      return createKolkataDate(year, month, day + 1, 10, 0, 0);
    
    case "Weekly":
      // Every 7 days at 10 AM IST
      return createKolkataDate(year, month, day + 7, 10, 0, 0);
    
    case "Monthly":
      // Every month (same day of month) at 10 AM IST
      return createKolkataDate(year, month + 1, day, 10, 0, 0);
    
    case "Quarterly":
      // Every 3 months at 10 AM IST
      return createKolkataDate(year, month + 3, day, 10, 0, 0);
    
    case "Half Yearly":
      // Every 6 months at 10 AM IST
      return createKolkataDate(year, month + 6, day, 10, 0, 0);
    
    case "Yearly":
      // Every 12 months at 10 AM IST
      return createKolkataDate(year + 1, month, day, 10, 0, 0);
    
    default:
      return null;
  }
}

/**
 * Calculate the initial email schedule for a task
 * @param {string} taskType - The type of task
 * @param {Date} assignmentDate - When the task was assigned
 * @returns {Object} - Email schedule object with nextEmailDate and frequency info
 */
export function createEmailSchedule(taskType, assignmentDate = new Date()) {
  const nextEmailDate = calculateNextEmailDate(taskType, assignmentDate);
  
  return {
    taskType,
    assignmentDate: new Date(assignmentDate),
    nextEmailDate,
    lastEmailDate: assignmentDate, // First email sent on assignment
    frequency: getFrequencyInDays(taskType),
    isRecurring: taskType !== "One Time",
  };
}

/**
 * Get the frequency in days for a given task type
 * @param {string} taskType - The type of task
 * @returns {number|null} - Frequency in days, or null for One Time
 */
export function getFrequencyInDays(taskType) {
  const frequencyMap = {
    "One Time": null,
    "Daily": 1,
    "Weekly": 7,
    "Monthly": 30,
    "Quarterly": 90,
    "Half Yearly": 180,
    "Yearly": 365,
  };
  
  return frequencyMap[taskType] || null;
}

/**
 * Check if an email should be sent today based on the schedule
 * @param {Date} nextEmailDate - The next scheduled email date
 * @param {Date} currentDate - The current date to check against
 * @returns {boolean} - Whether an email should be sent today
 */
export function shouldSendEmailToday(nextEmailDate, currentDate = new Date()) {
  if (!nextEmailDate) return false;
  
  const next = new Date(nextEmailDate);
  const current = new Date(currentDate);
  
  // Reset time to midnight for date comparison
  next.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  
  return current.getTime() >= next.getTime();
}

/**
 * Update the email schedule after sending an email
 * @param {Object} currentSchedule - The current email schedule
 * @returns {Object} - The updated email schedule
 */
export function updateEmailSchedule(currentSchedule) {
  if (!currentSchedule || !currentSchedule.isRecurring) {
    return {
      ...currentSchedule,
      nextEmailDate: null,
    };
  }
  
  const nextEmailDate = calculateNextEmailDate(
    currentSchedule.taskType,
    new Date()
  );
  
  return {
    ...currentSchedule,
    lastEmailDate: new Date(),
    nextEmailDate,
  };
}

/**
 * Get all tasks that need emails sent today
 * @param {Array} tasks - Array of tasks with emailSchedule field
 * @param {Date} currentDate - The current date to check against
 * @returns {Array} - Tasks that need emails sent today
 */
export function getTasksNeedingEmails(tasks, currentDate = new Date()) {
  return tasks.filter(task => {
    if (!task.emailSchedule) return false;
    
    // Don't send emails for completed tasks
    if (task.status === "Completed") return false;
    
    return shouldSendEmailToday(task.emailSchedule.nextEmailDate, currentDate);
  });
}

/**
 * Validate if a task type is supported for email scheduling
 * @param {string} taskType - The task type to validate
 * @returns {boolean} - Whether the task type is supported
 */
export function isValidTaskType(taskType) {
  const validTypes = [
    "One Time",
    "Daily",
    "Weekly",
    "Monthly",
    "Quarterly",
    "Half Yearly",
    "Yearly",
  ];
  
  return validTypes.includes(taskType);
}

/**
 * Get a human-readable description of the email frequency
 * @param {string} taskType - The task type
 * @returns {string} - Human-readable frequency description
 */
export function getFrequencyDescription(taskType) {
  const descriptions = {
    "One Time": "One-time notification on assignment",
    "Daily": "Daily notifications until completed",
    "Weekly": "Weekly notifications (every 7 days)",
    "Monthly": "Monthly notifications",
    "Quarterly": "Quarterly notifications (every 3 months)",
    "Half Yearly": "Half-yearly notifications (every 6 months)",
    "Yearly": "Yearly notifications (every 12 months)",
  };
  
  return descriptions[taskType] || "Unknown frequency";
}
