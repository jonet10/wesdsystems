export const DEFAULT_PLATFORM_TIME_ZONE = "America/Port-au-Prince";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const parseOffsetMinutes = (timeZoneName: string | undefined) => {
  if (!timeZoneName) return 0;

  const match = timeZoneName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
};

export function getDatePartsInTimeZone(date: Date, timeZone = DEFAULT_PLATFORM_TIME_ZONE): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || "0";

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day")),
    hour: Number(getPart("hour")),
    minute: Number(getPart("minute")),
    second: Number(getPart("second")),
  };
}

export function getDateKeyInTimeZone(date: Date, timeZone = DEFAULT_PLATFORM_TIME_ZONE) {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function shiftDateKeyByMonths(dateKey: string, months: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, day));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function dateFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function getWeekdayLabelInTimeZone(date: Date, timeZone = DEFAULT_PLATFORM_TIME_ZONE, locale = "fr-FR") {
  const raw = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
  }).format(date);

  return raw.replace(/\./g, "").replace(/^\w/, (char) => char.toUpperCase());
}

export function getDayOfWeekInTimeZone(date: Date, timeZone = DEFAULT_PLATFORM_TIME_ZONE) {
  const raw = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[raw] ?? 0;
}

export function getDayRangeInTimeZone(dateKey: string, timeZone = DEFAULT_PLATFORM_TIME_ZONE) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const offsetMinutes = parseOffsetMinutes(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(utcMidnight)).find((part) => part.type === "timeZoneName")?.value
  );

  const start = new Date(utcMidnight - offsetMinutes * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
