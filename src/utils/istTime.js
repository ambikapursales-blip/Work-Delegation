const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getKolkataDateParts(date) {
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

export function createKolkataDate(year, month, day, hour = 9, minute = 0, second = 0) {
  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  return new Date(utcTimestamp - KOLKATA_OFFSET_MS);
}

export function toKolkataDate(date) {
  if (!date) return null;
  const d = new Date(date);
  const { year, month, day, hour, minute, second } = getKolkataDateParts(d);
  return createKolkataDate(year, month, day, hour, minute, second);
}
