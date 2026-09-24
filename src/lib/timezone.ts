/**
 * Philippine Standard Time (PST / PHT) Timezone Utilities
 * Time Zone: Asia/Manila (UTC+8, no daylight saving time)
 *
 * Ensures all sessions, matches, calendars, and timestamps across
 * client devices and Vercel/Node server environments (which run in UTC)
 * remain 100% strictly synchronized to Philippine Time.
 */

export const PHILIPPINES_TIMEZONE = "Asia/Manila";
export const PHILIPPINES_LOCALE = "en-PH";

/**
 * Parses a date or datetime-local input string into a standard UTC ISO 8601 string,
 * explicitly interpreting any wall-clock time without timezone offset as Asia/Manila (UTC+8).
 *
 * Example: "2026-09-24T18:00" -> "2026-09-24T10:00:00.000Z"
 */
export function parsePHTToISO(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return "";
  const trimmed = dateTimeStr.trim();
  if (!trimmed) return "";

  // If the string already has an explicit timezone (e.g., Z, +08:00, -05:00)
  if (trimmed.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }

  // Format from HTML datetime-local: YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
  // Append +08:00 to anchor it directly to Philippine Time
  const hasSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed);
  const normalized = hasSeconds ? `${trimmed}+08:00` : `${trimmed}:00+08:00`;
  const d = new Date(normalized);

  if (isNaN(d.getTime())) {
    // Fallback attempt
    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? "" : fallback.toISOString();
  }

  return d.toISOString();
}

/**
 * Converts a UTC ISO string (or Date) to a "YYYY-MM-DDTHH:mm" format in Philippine Time,
 * suitable for populating HTML <input type="datetime-local" /> defaultValue.
 *
 * Example: "2026-09-24T10:00:00.000Z" -> "2026-09-24T18:00"
 */
export function toPHTDateTimeLocal(isoString?: string | Date | null): string {
  if (!isoString) return "";
  const d = typeof isoString === "string" ? new Date(isoString) : isoString;
  if (!d || isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINES_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const findPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const year = findPart("year");
  const month = findPart("month");
  const day = findPart("day");
  let hour = findPart("hour");
  if (hour === "24") hour = "00";
  const minute = findPart("minute");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Formats a time in Philippine Time (Asia/Manila).
 * Example: "6:00 PM"
 */
export function formatPHTTime(
  date?: string | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "";

  return d.toLocaleTimeString("en-US", {
    timeZone: PHILIPPINES_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  });
}

/**
 * Formats a date in Philippine Time (Asia/Manila).
 * Example: "Thu, Sep 24"
 */
export function formatPHTDate(
  date?: string | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-US", {
    timeZone: PHILIPPINES_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...options,
  });
}

/**
 * Formats date and time together in Philippine Time.
 * Example: "Thu, Sep 24 • 6:00 PM"
 */
export function formatPHTDateTime(date?: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "";

  const datePart = formatPHTDate(d);
  const timePart = formatPHTTime(d);
  return `${datePart} • ${timePart}`;
}

/**
 * Formats date, time, and timezone label in Philippine Time.
 * Example: "Thu, Sep 24, 2026 • 6:00 PM PHT"
 */
export function formatPHTFull(date?: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "";

  const datePart = formatPHTDate(d, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timePart = formatPHTTime(d);
  return `${datePart} • ${timePart} PHT`;
}

/**
 * Live Navbar Clock string in Philippine Standard Time.
 * Example: "06:00:00 PM PHT"
 */
export function formatPHTClock(date: Date = new Date()): string {
  const timeStr = date.toLocaleTimeString("en-US", {
    timeZone: PHILIPPINES_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${timeStr} PHT`;
}

/**
 * Returns today's date formatted as "YYYY-MM-DD" in Philippine Time.
 * Useful for export filenames and day grouping.
 */
export function getPHTTodayString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHILIPPINES_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}
