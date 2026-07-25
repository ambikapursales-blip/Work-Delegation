/**
 * Occurrence Naming Utility
 * 
 * Generates task names for recurring task occurrences with date information.
 * Each occurrence gets a unique name that includes the occurrence date/time.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Format date as "25 Jul 2026"
 */
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format date with time as "25 Jul 2026 14:30"
 */
function formatDateTime(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

/**
 * Get week number from date
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Get quarter from date (1-4)
 */
function getQuarter(date) {
  const month = new Date(date).getMonth();
  return Math.floor(month / 3) + 1;
}

/**
 * Get half year from date (1-2)
 */
function getHalfYear(date) {
  const month = new Date(date).getMonth();
  return month < 6 ? 1 : 2;
}

/**
 * Generate daily occurrence name
 * Example: "Excel Update - 25 Jul 2026"
 */
export function generateDailyName(baseTitle, occurrenceDate) {
  const dateStr = formatDate(occurrenceDate);
  return `${baseTitle} - ${dateStr}`;
}

/**
 * Generate weekly occurrence name
 * Example: "Weekly Sales Report - Week 31 - 2026"
 */
export function generateWeeklyName(baseTitle, occurrenceDate) {
  const weekNumber = getWeekNumber(occurrenceDate);
  const year = new Date(occurrenceDate).getFullYear();
  return `${baseTitle} - Week ${weekNumber} - ${year}`;
}

/**
 * Generate monthly occurrence name
 * Example: "GST Filing - August 2026"
 */
export function generateMonthlyName(baseTitle, occurrenceDate) {
  const monthName = MONTHS[new Date(occurrenceDate).getMonth()];
  const year = new Date(occurrenceDate).getFullYear();
  return `${baseTitle} - ${monthName} ${year}`;
}

/**
 * Generate quarterly occurrence name
 * Example: "Quarterly Review - Q3 2026"
 */
export function generateQuarterlyName(baseTitle, occurrenceDate) {
  const quarter = getQuarter(occurrenceDate);
  const year = new Date(occurrenceDate).getFullYear();
  return `${baseTitle} - Q${quarter} ${year}`;
}

/**
 * Generate half-yearly occurrence name
 * Example: "Half Yearly Review - H1 2026"
 */
export function generateHalfYearlyName(baseTitle, occurrenceDate) {
  const half = getHalfYear(occurrenceDate);
  const year = new Date(occurrenceDate).getFullYear();
  return `${baseTitle} - H${half} ${year}`;
}

/**
 * Generate yearly occurrence name
 * Example: "AMC Renewal - 2026"
 */
export function generateYearlyName(baseTitle, occurrenceDate) {
  const year = new Date(occurrenceDate).getFullYear();
  return `${baseTitle} - ${year}`;
}

/**
 * Generate custom interval occurrence name
 * Example: "Custom Task - 25 Jul 2026 14:30"
 */
export function generateCustomName(baseTitle, occurrenceDate, intervalUnit) {
  // For minutes/hours, include time. For days/weeks/months, just date.
  const timeBasedUnits = ["Minutes", "Hours"];
  if (timeBasedUnits.includes(intervalUnit)) {
    return `${baseTitle} - ${formatDateTime(occurrenceDate)}`;
  }
  return `${baseTitle} - ${formatDate(occurrenceDate)}`;
}

/**
 * Main function to generate occurrence name based on task type
 */
export function generateOccurrenceName(baseTitle, taskType, occurrenceDate, recurrencePattern) {
  if (!baseTitle) return "Untitled Task";
  if (!occurrenceDate) return baseTitle;

  switch (taskType) {
    case "Daily":
      return generateDailyName(baseTitle, occurrenceDate);
    case "Weekly":
      return generateWeeklyName(baseTitle, occurrenceDate);
    case "Monthly":
      return generateMonthlyName(baseTitle, occurrenceDate);
    case "Quarterly":
      return generateQuarterlyName(baseTitle, occurrenceDate);
    case "Half Yearly":
      return generateHalfYearlyName(baseTitle, occurrenceDate);
    case "Yearly":
      return generateYearlyName(baseTitle, occurrenceDate);
    case "Custom":
      const intervalUnit = recurrencePattern?.intervalUnit || "Days";
      return generateCustomName(baseTitle, occurrenceDate, intervalUnit);
    case "One Time":
    default:
      return baseTitle;
  }
}
