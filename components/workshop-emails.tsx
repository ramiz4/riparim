"use client";
import { cn } from "@/lib/utils";
import {
  inputClassName,
  helpTextClassName,
  appButton,
} from "@/lib/presentation";

import { useId, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";
import {
  workshopEmailLimit,
  type WorkshopEmailEdit,
} from "@/lib/workshop-emails";

export function WorkshopEmailsEditor({
  emails,
  onChange,
  presentation = "form",
}: {
  emails: WorkshopEmailEdit[];
  onChange: (emails: WorkshopEmailEdit[]) => void;
  presentation?: "form" | "business";
}) {
  const { t } = useI18n(),
    id = useId(),
    inputs = useRef<(HTMLInputElement | null)[]>([]),
    add = useRef<HTMLButtonElement | null>(null);
  function remove(index: number) {
    onChange(emails.filter((_, i) => i !== index));
    requestAnimationFrame(() => {
      (
        inputs.current[Math.min(index, emails.length - 2)] ?? add.current
      )?.focus();
    });
  }
  return (
    <fieldset
      className={cn(
        "my-4 min-w-0 rounded-[var(--radius)] border border-border p-4",
        presentation === "business" && "grid gap-4",
      )}
    >
      <legend>{t("common.workshopEmails")}</legend>
      <p className={cn(helpTextClassName, "leading-[1.65]")}>
        {t("common.workshopEmailsHelp")}
      </p>
      {emails.map((entry, index) => (
        <div
          data-ui="workshop-email-row"
          className="my-3 flex flex-wrap items-end gap-3"
          key={index}
        >
          <label
            className={cn(
              presentation === "form"
                ? "block text-[14px] font-semibold text-[#40594b] dark:text-foreground"
                : "grid gap-[7px] text-[14px] font-semibold text-foreground",
              "min-w-0 flex-1 at-most-480:basis-full",
            )}
            htmlFor={`${id}-${index}`}
          >
            {t("common.workshopEmailNumber", { number: index + 1 })}
            <input
              className={cn(
                presentation === "form"
                  ? inputClassName
                  : "min-h-11 rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring",
                "w-full min-w-0",
              )}
              ref={(node) => {
                inputs.current[index] = node;
              }}
              id={`${id}-${index}`}
              type="email"
              autoComplete="off"
              maxLength={254}
              value={entry.address}
              onChange={(event) =>
                onChange(
                  emails.map((value, i) =>
                    i === index
                      ? {
                          ...value,
                          address: event.target.value,
                          verified: false,
                        }
                      : value,
                  ),
                )
              }
            />
          </label>
          <button
            className={cn(appButton({ variant: "outline" }), "px-[13px] py-2")}
            type="button"
            aria-label={t("common.workshopEmailRemove", { number: index + 1 })}
            onClick={() => remove(index)}
          >
            {t("common.hoursRemove")}
          </button>
          <div className="flex w-full flex-wrap gap-4">
            <label className="flex flex-none flex-row items-center gap-[0.4rem] font-normal">
              <input
                className="h-auto min-h-0 w-auto"
                type="checkbox"
                checked={entry.active}
                aria-label={`${t("common.workshopEmailEnable")} ${index + 1}`}
                onChange={(event) =>
                  onChange(
                    emails.map((value, i) =>
                      i === index
                        ? { ...value, active: event.target.checked }
                        : value,
                    ),
                  )
                }
              />
              {t("common.workshopEmailEnable")}
            </label>
            <label className="flex flex-none flex-row items-center gap-[0.4rem] font-normal">
              <input
                className="h-auto min-h-0 w-auto"
                type="checkbox"
                checked={entry.verified}
                aria-label={`${t("common.workshopEmailVerify")} ${index + 1}`}
                onChange={(event) =>
                  onChange(
                    emails.map((value, i) =>
                      i === index
                        ? { ...value, verified: event.target.checked }
                        : value,
                    ),
                  )
                }
              />
              {t("common.workshopEmailVerify")}
            </label>
          </div>
        </div>
      ))}
      <button
        ref={add}
        className={cn(appButton({ variant: "outline" }), "px-[13px] py-2")}
        type="button"
        disabled={emails.length >= workshopEmailLimit}
        onClick={() => {
          onChange([...emails, { address: "", active: true, verified: false }]);
          requestAnimationFrame(() => inputs.current[emails.length]?.focus());
        }}
      >
        {t("common.workshopEmailAdd")}
      </button>
    </fieldset>
  );
}
