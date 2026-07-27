/**
 * Occurrence Naming Utility
 * 
 * Generates task names for recurring task occurrences with date information.
 * Each occurrence gets a unique name that includes the occurrence date/time.
 * All dates are extracted in IST (Asia/Kolkata) for consistency.
 */

import { getKolkataDateParts } from "./istTime.js";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Format date as "25 Jul 2026" using IST date parts
 */
function formatDate(date) {
  if (!date) return "";
  const { year, month, day } = getKolkataDateParts(new Date(date));
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * Format date with time as "25 Jul 2026 14:30" using IST date parts
 */
function formatDateTime(date) {
  if (!date) return "";
  const { year, month, day, hour, minute } = getKolkataDateParts(new Date(date));
  const hours = String(hour).padStart(2, '0');
  const minutes = String(minute).padStart(2, '0');
  return `${day} ${MONTHS[month - 1]} ${year} ${hours}:${minutes}`;
}

/**
 * Get ISO week number from date (IST-based)
 */
function getWeekNumber(date) {
  const { year, month, day } = getKolkataDateParts(new Date(date));
  // Create a Date using IST values interpreted as local to compute week number
  const istDate = new Date(year, month - 1, day);
  istDate.setHours(0, 0, 0, 0);
  istDate.setDate(istDate.getDate() + 4 - (istDate.getDay() || 7));
  const yearStart = new Date(istDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((istDate - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Get quarter from date (1-4) using IST month
 */
function getQuarter(date) {
  const { month } = getKolkataDateParts(new Date(date));
  return Math.floor((month - 1) / 3) + 1;
}

/**
 * Get half year from date (1-2) using IST month
 */
function getHalfYear(date) {
  const { month } = getKolkataDateParts(new Date(date));
  return month <= 6 ? 1 : 2;
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
  const { year } = getKolkataDateParts(occurrenceDate);
  return `${baseTitle} - Week ${weekNumber} - ${year}`;
}

/**
 * Generate monthly occurrence name
 * Example: "GST Filing - August 2026"
 */
export function generateMonthlyName(baseTitle, occurrenceDate) {
  const { year, month } = getKolkataDateParts(occurrenceDate);
  const monthName = MONTHS[month - 1];
  return `${baseTitle} - ${monthName} ${year}`;
}

/**
 * Generate quarterly occurrence name
 * Example: "Quarterly Review - Q3 2026"
 */
export function generateQuarterlyName(baseTitle, occurrenceDate) {
  const quarter = getQuarter(occurrenceDate);
  const { year } = getKolkataDateParts(occurrenceDate);
  return `${baseTitle} - Q${quarter} ${year}`;
}

/**
 * Generate half-yearly occurrence name
 * Example: "Half Yearly Review - H1 2026"
 */
export function generateHalfYearlyName(baseTitle, occurrenceDate) {
  const half = getHalfYear(occurrenceDate);
  const { year } = getKolkataDateParts(occurrenceDate);
  return `${baseTitle} - H${half} ${year}`;
}

/**
 * Generate yearly occurrence name
 * Example: "AMC Renewal - 2026"
 */
export function generateYearlyName(baseTitle, occurrenceDate) {
  const { year } = getKolkataDateParts(occurrenceDate);
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
