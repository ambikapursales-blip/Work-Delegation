const IST_TIMEZONE = "Asia/Kolkata";
const IST_LOCALE = "en-IN";

export function formatDate(date, options = {}) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

export function formatDateTime(date, options = {}) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatTime(date, options = {}) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatFullDate(date) {
  return formatDate(date, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatRelative(date, now = new Date()) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const nowStr = formatDate(now);
  const dateStr = formatDate(d);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  if (dateStr === nowStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  return formatDate(d);
}

export function formatToIST(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatDateEN(date) {
  return formatFullDate(date);
}
