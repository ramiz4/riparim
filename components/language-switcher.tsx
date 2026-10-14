"use client";
import { storedLanguages } from "@/lib/i18n/canonical-values";

import { useId, useState, useRef, useLayoutEffect } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { isLocale, locales } from "@/lib/i18n/locale";
import { preferredLanguageHref } from "@/lib/i18n/preference";
import { useNavigationState } from "@/lib/i18n/navigation-guard";
const names = { de: storedLanguages.german, sq: "Shqip", en: "English" };
export function LanguageSwitcher({
  verifiedAccount = false,
}: {
  verifiedAccount?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const { locale, t } = useI18n(),
    state = useNavigationState(),
    id = useId(),
    latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  }, [state]);
  return (
    <label
      className="group/language relative flex shrink-0 items-center text-[0.8125rem] text-foreground"
      htmlFor={id}
    >
      <Globe
        className="pointer-events-none absolute left-3 text-[var(--theme-accent)] group-has-[select:disabled]/language:opacity-[0.55] at-most-480:hidden"
        size={16}
        aria-hidden="true"
      />
      <span className="sr-only">{t("common.languageLabel")}</span>
      <select
        id={id}
        className="min-h-10 w-[124px] cursor-pointer appearance-none rounded-full border border-border bg-[var(--theme-surface)] pt-2 pr-[29px] pb-2 pl-[35px] [font-size:inherit] font-[550] leading-[1.25] text-inherit [transition:background_0.15s_ease,border-color_0.15s_ease] hover:enabled:border-[var(--theme-accent)] hover:enabled:bg-[var(--theme-hover)] focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px] disabled:cursor-wait disabled:opacity-[0.55] motion-reduce:transition-none at-most-480:min-h-11 at-most-480:w-[88px] at-most-480:pr-[25px] at-most-480:pl-3 at-most-480:text-[0.75rem] at-most-380:w-[76px] at-most-380:pr-5 at-most-380:pl-2"
        value={locale}
        disabled={state.busy || saving}
        onChange={async (event) => {
          const next = event.target.value;
          if (!isLocale(next) || next === locale || state.busy || saving)
            return;
          if (state.dirty && !window.confirm(t("common.discardDraft"))) return;
          setSaving(true);
          let navigating = false;
          try {
            const destination = await preferredLanguageHref(
              `${window.location.pathname}${window.location.search}${window.location.hash}`,
              next,
              verifiedAccount,
            );
            // Private inputs can change during the bounded preference request. Re-check
            // committed guards and confirm current drafts immediately before leaving.
            if (latest.current.busy) return;
            if (
              latest.current.dirty &&
              !window.confirm(t("common.discardDraft"))
            )
              return;
            if (latest.current.busy) return;
            window.location.assign(destination);
            navigating = true;
          } finally {
            if (!navigating) setSaving(false);
          }
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value} lang={value}>
            {names[value]}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-[10px] text-[var(--theme-accent)] group-has-[select:disabled]/language:opacity-[0.55] at-most-380:right-[6px]"
        size={14}
        aria-hidden="true"
      />
    </label>
  );
}
