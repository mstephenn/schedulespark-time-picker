import { describe, expect, it } from "vitest";

import {
  clampTime,
  formatMinutesAsDisplayTime,
  formatMinutesAsTime,
  generateTimeOptions,
  isTimeInRange,
  parseTimeToMinutes
} from "../src/utils/time-utils";

describe("time utilities", () => {
  it("normalizes common typed time values to minutes", () => {
    expect(parseTimeToMinutes("9")).toBe(540);
    expect(parseTimeToMinutes("915")).toBe(555);
    expect(parseTimeToMinutes("09:15")).toBe(555);
    expect(parseTimeToMinutes("24:00")).toBeNull();
  });

  it("formats minute offsets as HH:mm", () => {
    expect(formatMinutesAsTime(0)).toBe("00:00");
    expect(formatMinutesAsTime(555)).toBe("09:15");
    expect(formatMinutesAsTime(1439)).toBe("23:59");
  });

  it("formats display labels in 12-hour and 24-hour modes", () => {
    expect(formatMinutesAsDisplayTime(0, "24h")).toBe("00:00");
    expect(formatMinutesAsDisplayTime(0, "12h")).toBe("12:00 AM");
    expect(formatMinutesAsDisplayTime(780, "12h")).toBe("1:00 PM");
    expect(formatMinutesAsDisplayTime(1439, "12h")).toBe("11:59 PM");
  });

  it("parses 12-hour input without changing the full-day range", () => {
    expect(parseTimeToMinutes("11:59 AM")).toBe(719);
    expect(parseTimeToMinutes("11:59 PM")).toBe(1439);
    expect(parseTimeToMinutes("12:00 AM")).toBe(0);
    expect(parseTimeToMinutes("12:00 PM")).toBe(720);
  });

  it("generates stepped time options inside the provided range", () => {
    expect(generateTimeOptions({ minuteStep: 30, minTime: "08:00", maxTime: "09:00" })).toEqual([
      "08:00",
      "08:30",
      "09:00"
    ]);
  });

  it("clamps values to min and max time bounds", () => {
    expect(clampTime("07:45", "08:00", "17:00")).toBe("08:00");
    expect(clampTime("18:15", "08:00", "17:00")).toBe("17:00");
    expect(clampTime("12:30", "08:00", "17:00")).toBe("12:30");
  });

  it("checks whether a time is within optional bounds", () => {
    expect(isTimeInRange("00:00")).toBe(true);
    expect(isTimeInRange("23:59")).toBe(true);
    expect(isTimeInRange("24:00")).toBe(false);
    expect(isTimeInRange("08:59", "09:00", "17:00")).toBe(false);
    expect(isTimeInRange("09:00", "09:00", "17:00")).toBe(true);
    expect(isTimeInRange("17:01", "09:00", "17:00")).toBe(false);
  });
});
