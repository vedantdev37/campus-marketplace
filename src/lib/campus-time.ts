/**
 * Dates and times in campus time (IST), whatever zone the code runs in.
 *
 * A meetup is an appointment at a place, so its time means campus time: the
 * server on Vercel runs in UTC and a phone may be set to anything. Everything
 * here goes through an explicit `Asia/Kolkata`, and nothing reads the local
 * zone.
 *
 * The strings are assembled from numeric parts rather than taken whole from
 * `toLocaleString`. Node and a browser can disagree on the details of a
 * formatted date ("pm" or "PM", which kind of space), and a Client Component
 * that renders one string on the server and another in the browser fails
 * hydration. Numbers and these two fixed name lists cannot differ.
 */

export const CAMPUS_TIME_ZONE = "Asia/Kolkata";

/** IST has no daylight saving, so the offset is a constant. */
const CAMPUS_OFFSET = "+05:30";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PARTS_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPUS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type CampusParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function campusParts(instant: Date): CampusParts {
  const read = Object.fromEntries(
    PARTS_FORMAT.formatToParts(instant).map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: read.year,
    month: read.month,
    day: read.day,
    hour: read.hour,
    minute: read.minute,
    // The weekday of that calendar date, computed in UTC so no zone is involved.
    weekday: new Date(Date.UTC(read.year, read.month - 1, read.day)).getUTCDay(),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `2026-10-13`, the campus calendar date of an instant. */
export function campusDate(instant: Date): string {
  const parts = campusParts(instant);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** The campus calendar date `days` after an instant. */
export function campusDatePlusDays(instant: Date, days: number): string {
  return campusDate(new Date(instant.getTime() + days * 24 * 60 * 60 * 1000));
}

/**
 * The instant meant by a date and a time typed on campus, or null when they do
 * not form a real one (31 February, 25:00).
 */
export function campusInstant(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const instant = new Date(`${date}T${time}:00${CAMPUS_OFFSET}`);

  // `new Date` rolls an impossible date forward instead of rejecting it, so
  // check that what came out is what went in.
  if (Number.isNaN(instant.getTime()) || campusDate(instant) !== date) {
    return null;
  }

  return instant;
}

/** `4:30 pm` */
export function formatCampusTime(iso: string): string {
  const { hour, minute } = campusParts(new Date(iso));
  return `${hour % 12 === 0 ? 12 : hour % 12}:${pad(minute)} ${hour < 12 ? "am" : "pm"}`;
}

/** `16:30`, the campus clock time of an instant, as a form value. */
export function campusClock(iso: string): string {
  const { hour, minute } = campusParts(new Date(iso));
  return hourLabel(hour, minute);
}

/** `Tue 13 Oct` */
export function formatCampusDay(iso: string): string {
  const { weekday, day, month } = campusParts(new Date(iso));
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;
}

/** `Tue 13 Oct, 4:30 pm` */
export function formatCampusDateTime(iso: string): string {
  return `${formatCampusDay(iso)}, ${formatCampusTime(iso)}`;
}

/** `08:00` for a whole hour, as an option value and for comparison. */
export function hourLabel(hour: number, minute = 0): string {
  return `${pad(hour)}:${pad(minute)}`;
}
