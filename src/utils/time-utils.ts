import type { TimeFormat } from "../types";

/**
 * Options used to generate or restrict selectable times.
 */
export interface TimeRangeOptions {
  maxTime?: string;
  minTime?: string;
  minuteStep?: number;
}

const MINUTES_PER_DAY = 24 * 60;

interface ParsedTimeParts {
  hours: number;
  minutes: number;
}

/**
 * Converts a typed time value into minutes after midnight.
 */
export function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  const periodMatch = /\s*([ap]m)$/i.exec(trimmed);
  const valueWithoutPeriod = periodMatch === null ? trimmed : trimmed.slice(0, periodMatch.index).trim();
  const parts = parseTimeParts(valueWithoutPeriod);
  if (parts === null) return null;

  if (periodMatch !== null) {
    const periodHour = normalizePeriodHour(parts.hours, periodMatch[1].toUpperCase());
    if (periodHour === null) return null;
    return (periodHour * 60) + parts.minutes;
  }

  if (parts.hours > 23) return null;

  return (parts.hours * 60) + parts.minutes;
}

/**
 * Parses compact or colon-separated time parts.
 */
function parseTimeParts(value: string): ParsedTimeParts | null {
  const compactMatch = /^(\d{1,2})(?::?(\d{2}))?$/.exec(value);
  if (compactMatch === null) return null;

  const hours = Number(compactMatch[1]);
  const minuteMatch = compactMatch.at(2);
  const minutes = minuteMatch === undefined ? 0 : Number(minuteMatch);
  if (minutes > 59) return null;

  return { hours, minutes };
}

/**
 * Converts a 12-hour clock hour and period into a 24-hour clock hour.
 */
function normalizePeriodHour(hours: number, period: string): number | null {
  if (hours < 1 || hours > 12) return null;
  if (period === "AM") return hours % 12;
  if (period === "PM") return (hours % 12) + 12;
  return null;
}

/**
 * Formats minutes after midnight as HH:mm.
 */
export function formatMinutesAsTime(minutes: number): string {
  const boundedMinutes = Math.min(Math.max(minutes, 0), MINUTES_PER_DAY - 1);
  const hours = Math.floor(boundedMinutes / 60);
  const minute = boundedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Formats minutes after midnight for display in the selected clock format.
 */
export function formatMinutesAsDisplayTime(minutes: number, timeFormat: TimeFormat = "24h"): string {
  const boundedMinutes = Math.min(Math.max(minutes, 0), MINUTES_PER_DAY - 1);
  if (timeFormat === "24h") return formatMinutesAsTime(boundedMinutes);

  const hours = Math.floor(boundedMinutes / 60);
  const minute = boundedMinutes % 60;
  const period = hours < 12 ? "AM" : "PM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHour)}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * Clamps a time string to optional min and max bounds.
 */
export function clampTime(value: string, minTime?: string, maxTime?: string): string {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return value;

  const min = minTime === undefined ? 0 : parseTimeToMinutes(minTime);
  const max = maxTime === undefined ? MINUTES_PER_DAY - 1 : parseTimeToMinutes(maxTime);
  const lower = min ?? 0;
  const upper = max ?? MINUTES_PER_DAY - 1;

  return formatMinutesAsTime(Math.min(Math.max(minutes, lower), upper));
}

/**
 * Checks whether a time is valid and within optional min and max bounds.
 */
export function isTimeInRange(value: string, minTime?: string, maxTime?: string): boolean {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return false;

  const min = minTime === undefined ? 0 : parseTimeToMinutes(minTime);
  const max = maxTime === undefined ? MINUTES_PER_DAY - 1 : parseTimeToMinutes(maxTime);
  return minutes >= (min ?? 0) && minutes <= (max ?? MINUTES_PER_DAY - 1);
}

/**
 * Generates selectable HH:mm options for the provided range and step.
 */
export function generateTimeOptions(options: TimeRangeOptions = {}): string[] {
  const minuteStep = normalizeMinuteStep(options.minuteStep);
  const min = parseTimeToMinutes(options.minTime ?? "00:00") ?? 0;
  const max = parseTimeToMinutes(options.maxTime ?? "23:59") ?? MINUTES_PER_DAY - 1;
  const values: string[] = [];

  for (let minutes = min; minutes <= max; minutes += minuteStep) {
    values.push(formatMinutesAsTime(minutes));
  }

  return values;
}

/**
 * Normalizes a time value to HH:mm when possible.
 */
export function normalizeTime(value: string, minTime?: string, maxTime?: string): string | null {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return null;
  return clampTime(formatMinutesAsTime(minutes), minTime, maxTime);
}

/**
 * Adds minutes to a time value and returns a normalized HH:mm value.
 */
export function addMinutesToTime(value: string, minutesToAdd: number, minTime?: string, maxTime?: string): string | null {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return null;
  return clampTime(formatMinutesAsTime(minutes + minutesToAdd), minTime, maxTime);
}

/**
 * Keeps minute steps within a practical one-hour range. Exported so every minute-step
 * consumer (digital options, analog drag rounding) agrees on the same fallback for an
 * invalid step (0, negative, non-integer, or >60), instead of each re-deriving its own.
 */
export function normalizeMinuteStep(minuteStep = 15): number {
  if (!Number.isInteger(minuteStep) || minuteStep < 1 || minuteStep > 60) return 15;
  return minuteStep;
}

