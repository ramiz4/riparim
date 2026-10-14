"use client";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectionDraft = { choice: string; detail: string };
export type SelectionOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
export function selectedChoiceText(
  draft: SelectionDraft,
  options: readonly SelectionOption[],
) {
  if (draft.choice === "other") return draft.detail.trim();
  return (
    options.find((option) => option.value === draft.choice && !option.disabled)
      ?.label ?? ""
  );
}
export function SelectWithOther({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  detailLabel,
  detailPlaceholder,
  minLength,
  maxLength,
  disabled = false,
  describedBy,
  presentation = "default",
}: {
  id: string;
  label: string;
  placeholder: string;
  options: readonly SelectionOption[];
  value: SelectionDraft;
  onChange: (value: SelectionDraft) => void;
  detailLabel: string;
  detailPlaceholder: string;
  minLength: number;
  maxLength: number;
  disabled?: boolean;
  describedBy?: string;
  presentation?: "default" | "claim" | "moderation";
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-[7px]",
        presentation === "moderation" && "mt-4",
      )}
    >
      <label
        className={cn(
          "m-0 block text-[14px] font-semibold text-foreground",
          presentation === "claim" && "grid gap-[7px]",
          presentation === "moderation" && "dark:text-muted-foreground",
        )}
        htmlFor={id}
      >
        {label}
      </label>
      <Select
        value={value.choice}
        disabled={disabled}
        onValueChange={(choice) => {
          if (
            !disabled &&
            options.some(
              (option) => option.value === choice && !option.disabled,
            )
          )
            onChange({ ...value, choice });
        }}
      >
        <SelectTrigger
          className="h-auto min-h-11 w-full rounded-lg border border-input bg-background px-3 py-[10px] text-left text-[14px] text-foreground data-[placeholder]:text-foreground whitespace-normal shadow-none focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-[#288f82] focus-visible:outline-offset-4 focus-visible:ring-0 focus-visible:border-input dark:focus-visible:outline-ring disabled:opacity-[0.45] data-[size=default]:h-auto dark:bg-background dark:hover:bg-background"
          id={id}
          aria-describedby={describedBy}
        >
          <SelectValue
            className="block min-w-0 overflow-visible text-left whitespace-normal [overflow-wrap:anywhere] [-webkit-line-clamp:unset]"
            placeholder={placeholder}
          />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.choice === "other" && (
        <>
          <label
            className={cn(
              "m-0 block text-[14px] font-semibold text-foreground",
              presentation === "claim" && "grid gap-[7px]",
              presentation === "moderation" && "dark:text-muted-foreground",
            )}
            htmlFor={`${id}-details`}
          >
            {detailLabel}
          </label>
          <textarea
            id={`${id}-details`}
            className={cn(
              "m-0 min-h-[100px] w-full min-w-0 resize-y rounded-lg border border-input bg-background px-3 py-[10px] text-[14px] leading-[1.6] text-foreground focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]",
              presentation === "claim" &&
                "min-h-[92px] font-normal leading-[1.5] placeholder:text-muted-foreground placeholder:opacity-100",
              presentation === "moderation" && "block",
            )}
            aria-describedby={describedBy}
            required
            rows={3}
            minLength={minLength}
            maxLength={maxLength}
            disabled={disabled}
            value={value.detail}
            placeholder={detailPlaceholder}
            onChange={(event) => {
              if (!disabled) onChange({ ...value, detail: event.target.value });
            }}
          />
        </>
      )}
    </div>
  );
}
