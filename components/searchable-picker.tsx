"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { pickerVariants, type PickerPresentation } from "./picker-styles";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  id?: string;
  label: string;
  value: string | string[];
  values: string[];
  onChange: (value: string | string[]) => void;
  displayLabels?: Record<string, string>;
  multiple?: boolean;
  required?: boolean;
  placeholder?: string;
  allValue?: string;
  disabled?: boolean;
  disabledValues?: string[];
  presentation?: PickerPresentation;
  className?: string;
};
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
export function SearchablePicker({
  id,
  label,
  value,
  values,
  onChange,
  displayLabels,
  multiple = false,
  required = false,
  placeholder,
  allValue,
  disabled = false,
  disabledValues = [],
  presentation = "plain",
  className,
}: Props) {
  const { t } = useI18n(),
    listId = useId(),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const selected = Array.isArray(value) ? value : [value],
    labelFor = (item: string) => displayLabels?.[item] ?? item;
  const specificSelected = selected.filter((item) => item !== allValue);
  const matches = values
    .filter((item) =>
      normalized(labelFor(item)).includes(normalized(query.trim())),
    )
    .sort((a, b) =>
      multiple
        ? Number(selected.includes(b)) - Number(selected.includes(a))
        : 0,
    );
  const summary = !selected.length
    ? (placeholder ?? t("common.selectedOptions", { count: 0 }))
    : selected.length > 2
      ? t("common.selectedOptions", { count: selected.length })
      : selected.map(labelFor).join(", ");
  function choose(item: string) {
    if (multiple) {
      const next =
        item === allValue
          ? [item]
          : selected.includes(item)
            ? selected.filter((current) => current !== item)
            : [...selected.filter((current) => current !== allValue), item];
      onChange(next.length ? next : allValue ? [allValue] : []);
    } else {
      onChange(item);
      setOpen(false);
    }
  }
  function navigate(event: KeyboardEvent) {
    const options = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? [],
    );
    if (!options.length) return;
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : event.key === "ArrowDown"
              ? (index + 1) % options.length
              : index <= 0
                ? options.length - 1
                : index - 1;
      options[next].focus();
      options[next].scrollIntoView({ block: "nearest" });
    }
  }
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setQuery("");
      }}
    >
      <PopoverAnchor asChild>
        <div
          className={cn(
            pickerVariants({ presentation }),
            "flex items-center",
            presentation === "catalogue" ? "gap-[10px]" : "gap-[6px]",
            className,
          )}
          data-ui="picker-control"
          onClick={(event) => {
            if (!disabled && !(event.target as HTMLElement).closest("button")) {
              setOpen(true);
              setQuery("");
            }
          }}
        >
          {multiple && (
            <div className="flex min-w-0 flex-1 flex-wrap gap-[5px]">
              {specificSelected.length ? (
                <>
                  {specificSelected.slice(0, 2).map((item) => (
                    <span
                      className="inline-flex max-w-full items-center gap-1 rounded-[5px] bg-[var(--theme-hover)] pt-[3px] pr-1 pb-[3px] pl-[7px] text-[0.8125rem] leading-[1.4]"
                      key={item}
                    >
                      <span className="[overflow-wrap:anywhere]">
                        {labelFor(item)}
                      </span>
                      <button
                        type="button"
                        aria-label={t("common.removeOption", {
                          value: labelFor(item),
                        })}
                        disabled={disabled}
                        className="grid min-h-[26px] w-[26px] shrink-0 place-items-center rounded-[3px] hover:bg-secondary"
                        onClick={() => {
                          choose(item);
                          trigger.current?.focus({ preventScroll: true });
                        }}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {specificSelected.length > 2 && (
                    <button
                      type="button"
                      className="min-h-[30px] rounded-[5px] bg-[var(--theme-hover)] px-[7px] py-1 text-[0.8125rem] whitespace-nowrap"
                      onClick={() => {
                        setOpen(true);
                        setQuery("");
                      }}
                    >
                      {t("common.moreSelections", {
                        count: specificSelected.length - 2,
                      })}
                    </button>
                  )}
                </>
              ) : (
                <span
                  className="cursor-pointer"
                  onClick={() => {
                    if (!disabled) {
                      setOpen(true);
                      setQuery("");
                    }
                  }}
                >
                  {summary}
                </span>
              )}
            </div>
          )}
          <PopoverTrigger asChild>
            <button
              ref={trigger}
              id={id}
              type="button"
              className={cn(
                "flex min-h-6 min-w-0 flex-1 items-center justify-between gap-2 text-left [&>span]:min-w-0 [&>span]:[overflow-wrap:anywhere] [&>svg]:shrink-0",
                multiple &&
                  "min-h-[30px] flex-[0_0_30px] self-stretch justify-center",
              )}
              role="combobox"
              aria-label={label}
              aria-required={required || undefined}
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-controls={open ? `${listId}-popup` : undefined}
              disabled={disabled}
            >
              {multiple ? (
                <span className="sr-only">{summary}</span>
              ) : (
                <span data-slot="select-value">{summary}</span>
              )}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        id={`${listId}-popup`}
        className="w-[var(--radix-popover-trigger-width)] min-w-[min(260px,calc(100vw_-_32px))] max-w-[calc(100vw_-_32px)] overflow-hidden border-border bg-popover p-0 text-popover-foreground"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
        aria-label={label}
      >
        <div className="flex items-center gap-2 border-b border-border p-3 focus-within:[box-shadow:inset_0_-2px_var(--ring)]">
          <Search
            className="shrink-0 text-muted-foreground"
            size={16}
            aria-hidden="true"
          />
          <input
            ref={input}
            className="w-full min-w-0 border-0 bg-transparent text-[1rem] text-inherit outline-none"
            type="search"
            aria-label={t("common.searchOptions", { label })}
            placeholder={t("common.searchOptions", { label })}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={navigate}
          />
        </div>
        <div
          id={listId}
          ref={list}
          role="listbox"
          aria-label={label}
          aria-multiselectable={multiple || undefined}
          className="max-h-[min(260px,calc(var(--radix-popover-content-available-height,400px)_-_55px))] overflow-y-auto overscroll-contain p-[5px]"
          onKeyDown={navigate}
        >
          {matches.map((item) => (
            <button
              type="button"
              role="option"
              className="flex min-h-10 w-full items-center gap-[9px] rounded-[6px] p-2 text-left text-[0.875rem] hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:[outline:2px_solid_var(--ring)] focus-visible:outline-offset-[-2px] aria-selected:bg-[var(--theme-hover)] disabled:opacity-50"
              aria-selected={selected.includes(item)}
              disabled={disabledValues.includes(item)}
              key={item}
              onClick={() => choose(item)}
            >
              <span
                className="grid w-[18px] shrink-0 place-items-center text-[var(--theme-accent)] dark:text-ring"
                aria-hidden="true"
              >
                {selected.includes(item) && <Check size={16} />}
              </span>
              <span>{labelFor(item)}</span>
            </button>
          ))}
          {!matches.length && (
            <p
              className="px-[10px] py-4 text-[0.875rem] text-muted-foreground"
              role="status"
            >
              {t("common.noOptions")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
