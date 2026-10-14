import { z } from "zod";

import { kosovoTimeZone } from "./i18n/format";
export const openingTimeZone = kosovoTimeZone;
const minute = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const interval = z
  .object({
    start: time,
    end: z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/),
  })
  .strict()
  .refine(
    (value) => minute(value.start) < minute(value.end),
    "The end must follow the start on the same day.",
  );
export const openingDaySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("unknown") }).strict(),
  z.object({ mode: z.literal("closed") }).strict(),
  z.object({ mode: z.literal("appointment") }).strict(),
  z
    .object({
      mode: z.literal("open"),
      intervals: z
        .array(interval)
        .min(1)
        .max(3)
        .refine(
          (values) =>
            values.every(
              (value, index) =>
                index === 0 ||
                minute(values[index - 1].end) <= minute(value.start),
            ),
          "Intervals must be ordered and must not overlap.",
        ),
    })
    .strict(),
]);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
  );
export const openingHoursSchema = z
  .object({
    week: z.array(openingDaySchema).length(7),
    exceptions: z
      .array(z.object({ date, day: openingDaySchema }).strict())
      .max(60)
      .refine(
        (values) =>
          new Set(values.map((value) => value.date)).size === values.length,
        "Each date may appear only once.",
      ),
  })
  .strict();
export type OpeningDay = z.infer<typeof openingDaySchema>;
export type OpeningHours = z.infer<typeof openingHoursSchema>;
export function emptyOpeningHours(): OpeningHours {
  return {
    week: Array.from({ length: 7 }, () => ({ mode: "unknown" })),
    exceptions: [],
  };
}
export function decodeOpeningHours(value: unknown): OpeningHours | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = openingHoursSchema.safeParse(
    typeof value === "string" ? JSON.parse(value) : value,
  );
  if (!parsed.success) throw Error("Invalid stored workshop opening hours");
  return parsed.data;
}
function localMoment(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: openingTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    date,
    weekday: (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}
export function openingWeekday(now: Date) {
  return localMoment(now).weekday;
}
export function todayOpeningDay(hours: OpeningHours, now: Date): OpeningDay {
  const moment = localMoment(now);
  return (
    hours.exceptions.find((value) => value.date === moment.date)?.day ??
    hours.week[moment.weekday]
  );
}
export function openingStatus(
  hours: OpeningHours | null | undefined,
  now: Date,
): "unknown" | "appointment" | "open" | "closed" {
  if (!hours) return "unknown";
  const day = todayOpeningDay(hours, now);
  if (day.mode !== "open") return day.mode;
  const current = localMoment(now).minute;
  return day.intervals.some(
    (value) => minute(value.start) <= current && current < minute(value.end),
  )
    ? "open"
    : "closed";
}
