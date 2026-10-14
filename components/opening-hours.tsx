"use client";
import { useEffect, useId, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { appButton, helpTextClassName } from "@/lib/presentation";
import { ChevronDown, Clock3, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  openingWeekday,
  openingStatus,
  todayOpeningDay,
  emptyOpeningHours,
  type OpeningDay,
  type OpeningHours,
} from "@/lib/opening-hours";

const weekdayKeys = [
  "common.monday",
  "common.tuesday",
  "common.wednesday",
  "common.thursday",
  "common.friday",
  "common.saturday",
  "common.sunday",
] as const;
const modeKeys = {
  unknown: "common.hoursUnknown",
  closed: "common.hoursClosed",
  appointment: "common.hoursAppointment",
  open: "common.hoursOpen",
} as const;
export function OpeningHoursDetails({
  hours,
  todayIndex,
  presentation = "default",
}: {
  hours: OpeningHours | null | undefined;
  todayIndex?: number;
  presentation?: "default" | "popover";
}) {
  const { locale, t } = useI18n();
  if (!hours) return <p>{t("common.hoursMissing")}</p>;
  const label = (day: OpeningDay) =>
    day.mode === "open"
      ? day.intervals.map((value) => `${value.start}–${value.end}`).join(", ")
      : t(modeKeys[day.mode]);
  return (
    <>
      <dl className="text-[14px]" data-ui="opening-week">
        {hours.week.map((day, index) => (
          <div
            key={index}
            className={cn(
              "flex justify-between gap-4 py-[3px]",
              presentation === "popover" && "items-baseline rounded-[6px] p-2",
              presentation === "popover" &&
                index === todayIndex &&
                "bg-[var(--theme-hover)] font-[650]",
            )}
            aria-current={index === todayIndex ? "date" : undefined}
          >
            <dt
              className={cn(
                "shrink-0",
                presentation === "popover" &&
                  index !== todayIndex &&
                  "text-muted-foreground",
              )}
            >
              {t(weekdayKeys[index])}
            </dt>
            <dd
              className={cn(
                "m-0 text-right [overflow-wrap:anywhere]",
                presentation === "popover" && "tabular-nums",
              )}
            >
              {label(day)}
            </dd>
          </div>
        ))}
      </dl>
      {hours.exceptions.length > 0 && (
        <>
          <h3
            className={
              presentation === "popover"
                ? "mt-[14px] mr-2 mb-1 ml-2 text-[14px] font-semibold"
                : undefined
            }
          >
            {t("common.hoursExceptions")}
          </h3>
          <dl className="text-[14px]" data-ui="opening-exceptions">
            {[...hours.exceptions]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((value) => (
                <div
                  key={value.date}
                  className={cn(
                    "flex justify-between gap-4 py-[3px]",
                    presentation === "popover" &&
                      "items-baseline rounded-[6px] p-2",
                  )}
                >
                  <dt
                    className={cn(
                      "shrink-0",
                      presentation === "popover" && "text-muted-foreground",
                    )}
                  >
                    {formatDate(locale, value.date, { dateOnly: true })}
                  </dt>
                  <dd
                    className={cn(
                      "m-0 text-right [overflow-wrap:anywhere]",
                      presentation === "popover" && "tabular-nums",
                    )}
                  >
                    {label(value.day)}
                  </dd>
                </div>
              ))}
          </dl>
        </>
      )}
    </>
  );
}
export function WorkshopOpeningHours({
  hours: ownerHours,
  importedHours,
  confirmedAt,
  className,
}: {
  hours: OpeningHours | null | undefined;
  importedHours?: OpeningHours | null;
  confirmedAt?: string | null;
  className?: string;
}) {
  const hours = ownerHours ?? importedHours;
  const confirmed = !!ownerHours && !!confirmedAt;
  const { locale, t } = useI18n(),
    [now, setNow] = useState<Date | null>(null),
    [open, setOpen] = useState(false),
    id = useId();
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const status = now ? openingStatus(hours, now) : "unknown",
    today = hours && now ? todayOpeningDay(hours, now) : null;
  const todayLabel = today
    ? `${t("common.hoursToday")}: ${today.mode === "open" ? today.intervals.map((value) => `${value.start}–${value.end}`).join(", ") : t(modeKeys[today.mode])}`
    : t("common.hoursToday");
  return (
    <section
      className={cn(
        "mt-[18px] min-w-0 max-w-[580px] flex-1 text-[14px] text-[#576e64] dark:text-muted-foreground at-most-720:mt-[15px]",
        className,
      )}
      data-ui="workshop-opening-hours"
      aria-labelledby={`${id}-hours`}
    >
      <h2 className="sr-only" id={`${id}-hours`}>
        {t("common.hoursTitle")}
      </h2>
      {confirmed && hours && now && status !== "unknown" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-[6px]">
          <span
            className={cn(
              "text-[12px] font-semibold",
              status === "open" && "text-[var(--theme-accent)]",
            )}
            role="status"
          >
            {t(
              status === "open"
                ? "common.hoursNowOpen"
                : status === "closed"
                  ? "common.hoursNowClosed"
                  : "common.hoursAppointment",
            )}
          </span>
        </div>
      )}
      {hours ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex min-h-9 max-w-full items-center gap-[9px] rounded-[5px] text-left text-[14px] font-semibold text-inherit hover:text-[var(--theme-accent)] focus-visible:[outline:2px_solid_var(--ring)] focus-visible:outline-offset-[3px] dark:hover:text-ring [&>svg:last-child]:transition-transform [&>svg:last-child]:duration-150 data-[state=open]:[&>svg:last-child]:rotate-180 motion-reduce:[&>svg]:transition-none"
            >
              <Clock3 size={17} aria-hidden="true" />
              <span>{todayLabel}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="max-h-[min(560px,var(--radix-popover-content-available-height,560px))] w-[min(360px,calc(100vw_-_32px))] overflow-y-auto overscroll-contain rounded-xl border-border bg-popover p-4 text-popover-foreground [box-shadow:0_12px_36px_#0003]"
            data-ui="opening-hours-popover"
            align="start"
            aria-labelledby={`${id}-schedule`}
          >
            <div className="mb-[6px] flex items-center justify-between gap-4 border-b border-border pb-[10px]">
              <h3
                className="m-0 flex items-center gap-2 text-[15px] font-[650]"
                id={`${id}-schedule`}
              >
                <Clock3 size={17} aria-hidden="true" />
                {t("common.hoursTitle")}
              </h3>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-[6px] hover:bg-[var(--theme-hover)]"
                aria-label={t("common.close")}
                onClick={() => setOpen(false)}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <OpeningHoursDetails
              presentation="popover"
              hours={hours}
              todayIndex={now ? openingWeekday(now) : undefined}
            />
            {confirmed && (
              <p className="mx-2 mt-3 border-t border-border pt-3 text-[12px] leading-[1.6] text-muted-foreground">
                {t("common.hoursSource")}
                {confirmedAt && (
                  <>
                    {" "}
                    ·{" "}
                    {t("common.hoursConfirmed", {
                      date: formatDate(locale, confirmedAt),
                    })}
                  </>
                )}
              </p>
            )}
          </PopoverContent>
        </Popover>
      ) : (
        <OpeningHoursDetails hours={hours} />
      )}
    </section>
  );
}

function DayEditor({
  label,
  day,
  onChange,
}: {
  label: string;
  day: OpeningDay;
  onChange(value: OpeningDay): void;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-lg border border-border p-3">
      <legend>{label}</legend>
      <label className="grid gap-[7px] text-[14px] font-semibold">
        {t("common.hoursDayStatus")}
        <select
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-[10px] [font:inherit] text-foreground focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]"
          value={day.mode}
          onChange={(event) =>
            onChange(
              event.target.value === "open"
                ? {
                    mode: "open",
                    intervals: [{ start: "08:00", end: "17:00" }],
                  }
                : {
                    mode: event.target.value as
                      "unknown" | "closed" | "appointment",
                  },
            )
          }
        >
          {Object.entries(modeKeys).map(([mode, key]) => (
            <option key={mode} value={mode}>
              {t(key)}
            </option>
          ))}
        </select>
      </label>
      {day.mode === "open" && (
        <>
          <div>
            {day.intervals.map((interval, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <label className="grid min-w-[85px] flex-1 gap-[7px] text-[14px] font-semibold">
                  {t("common.hoursFrom")}
                  <input
                    className="min-h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 py-[10px] text-foreground focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]"
                    required
                    inputMode="numeric"
                    placeholder="08:00"
                    pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                    maxLength={5}
                    value={interval.start}
                    onChange={(event) =>
                      onChange({
                        ...day,
                        intervals: day.intervals.map((value, i) =>
                          i === index
                            ? { ...value, start: event.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                </label>
                <label className="grid min-w-[85px] flex-1 gap-[7px] text-[14px] font-semibold">
                  {t("common.hoursUntil")}
                  <input
                    className="min-h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 py-[10px] text-foreground focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]"
                    required
                    inputMode="numeric"
                    placeholder="17:00"
                    pattern="(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)"
                    maxLength={5}
                    value={interval.end}
                    onChange={(event) =>
                      onChange({
                        ...day,
                        intervals: day.intervals.map((value, i) =>
                          i === index
                            ? { ...value, end: event.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                </label>
                {day.intervals.length > 1 && (
                  <button
                    type="button"
                    className={cn(
                      appButton({ variant: "outline", size: "small" }),
                      "mt-2",
                    )}
                    aria-label={t("common.hoursRemoveInterval", {
                      day: label,
                      number: index + 1,
                    })}
                    onClick={() =>
                      onChange({
                        ...day,
                        intervals: day.intervals.filter((_, i) => i !== index),
                      })
                    }
                  >
                    {t("common.hoursRemove")}
                  </button>
                )}
              </div>
            ))}
          </div>
          {day.intervals.length < 3 && (
            <button
              type="button"
              className={cn(
                appButton({ variant: "outline", size: "small" }),
                "mt-2",
              )}
              onClick={() =>
                onChange({
                  ...day,
                  intervals: [...day.intervals, { start: "", end: "" }],
                })
              }
            >
              {t("common.hoursAddInterval")}
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}
export function OpeningHoursEditor({
  hours,
  onChange,
}: {
  hours: OpeningHours | null | undefined;
  onChange(value: OpeningHours | null): void;
}) {
  const { t } = useI18n();
  return (
    <fieldset
      className="my-5 grid min-w-0 gap-4 rounded-[10px] border border-border p-4 at-most-600:p-3"
      data-ui="opening-editor"
    >
      <legend>{t("common.hoursTitle")}</legend>
      <p className={cn(helpTextClassName, "leading-[1.65]")}>
        {t("common.hoursEditingHelp")}
      </p>
      <label className="flex items-center gap-[10px] text-[14px] font-semibold">
        <input
          type="checkbox"
          className="w-5 flex-[0_0_20px] focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]"
          checked={!!hours}
          onChange={(event) =>
            onChange(event.target.checked ? emptyOpeningHours() : null)
          }
        />
        {t("common.hoursProvide")}
      </label>
      {hours && (
        <>
          <div className="grid grid-cols-2 gap-[14px] at-most-600:grid-cols-1">
            {hours.week.map((day, index) => (
              <div key={index}>
                <DayEditor
                  label={t(weekdayKeys[index])}
                  day={day}
                  onChange={(value) =>
                    onChange({
                      ...hours,
                      week: hours.week.map((current, i) =>
                        i === index ? value : current,
                      ),
                    })
                  }
                />
                {index === 0 && (
                  <button
                    type="button"
                    className={cn(
                      appButton({ variant: "outline", size: "small" }),
                      "mt-2",
                    )}
                    onClick={() =>
                      onChange({
                        ...hours,
                        week: hours.week.map((value, i) =>
                          i < 5 ? structuredClone(day) : value,
                        ),
                      })
                    }
                  >
                    {t("common.hoursCopyWeekdays")}
                  </button>
                )}
              </div>
            ))}
          </div>
          <fieldset className="mt-5 grid min-w-0 gap-4">
            <legend>{t("common.hoursExceptions")}</legend>
            {hours.exceptions.map((exception, index) => (
              <div
                key={index}
                className="grid gap-[10px] border-b border-border py-3"
              >
                <label className="grid gap-[7px] text-[14px] font-semibold">
                  {t("common.hoursDate")}
                  <input
                    type="date"
                    className="min-h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 py-[10px] text-foreground focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]"
                    required
                    value={exception.date}
                    onChange={(event) =>
                      onChange({
                        ...hours,
                        exceptions: hours.exceptions.map((value, i) =>
                          i === index
                            ? { ...value, date: event.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                </label>
                <DayEditor
                  label={t("common.hoursExceptionDay")}
                  day={exception.day}
                  onChange={(value) =>
                    onChange({
                      ...hours,
                      exceptions: hours.exceptions.map((current, i) =>
                        i === index ? { ...current, day: value } : current,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className={cn(
                    appButton({ variant: "outline", size: "small" }),
                    "mt-2",
                  )}
                  onClick={() =>
                    onChange({
                      ...hours,
                      exceptions: hours.exceptions.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  {t("common.hoursRemove")}
                </button>
              </div>
            ))}
            {hours.exceptions.length < 60 && (
              <button
                type="button"
                className={cn(
                  appButton({ variant: "outline", size: "small" }),
                  "mt-2",
                )}
                onClick={() =>
                  onChange({
                    ...hours,
                    exceptions: [
                      ...hours.exceptions,
                      { date: "", day: { mode: "closed" } },
                    ],
                  })
                }
              >
                {t("common.hoursAddException")}
              </button>
            )}
          </fieldset>
        </>
      )}
    </fieldset>
  );
}
