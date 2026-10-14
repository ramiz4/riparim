"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
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
          className="picker searchable-picker-control"
          onClick={(event) => {
            if (!disabled && !(event.target as HTMLElement).closest("button")) {
              setOpen(true);
              setQuery("");
            }
          }}
        >
          {multiple && (
            <div className="searchable-picker-selected">
              {specificSelected.length ? (
                <>
                  {specificSelected.slice(0, 2).map((item) => (
                    <span className="searchable-picker-chip" key={item}>
                      <span>{labelFor(item)}</span>
                      <button
                        type="button"
                        aria-label={t("common.removeOption", {
                          value: labelFor(item),
                        })}
                        disabled={disabled}
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
                      className="searchable-picker-more"
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
                  className="searchable-picker-placeholder"
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
              className={`searchable-picker-trigger${multiple ? " searchable-picker-toggle" : ""}`}
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
        className="searchable-picker-content"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
        aria-label={label}
      >
        <div className="searchable-picker-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={input}
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
          className="searchable-picker-options"
          onKeyDown={navigate}
        >
          {matches.map((item) => (
            <button
              type="button"
              role="option"
              aria-selected={selected.includes(item)}
              disabled={disabledValues.includes(item)}
              key={item}
              onClick={() => choose(item)}
            >
              <span className="searchable-picker-check" aria-hidden="true">
                {selected.includes(item) && <Check size={16} />}
              </span>
              <span>{labelFor(item)}</span>
            </button>
          ))}
          {!matches.length && <p role="status">{t("common.noOptions")}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
