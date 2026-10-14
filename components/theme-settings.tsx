"use client";
import { useI18n } from "@/lib/i18n/client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const subscribe = () => () => {};

export function ThemeSettings() {
  const { t } = useI18n();
  const options = [
    {
      value: "light",
      label: t("customer.themeLight"),
      description: t("customer.themeLightNote"),
      Icon: Sun,
    },
    {
      value: "dark",
      label: t("customer.themeDark"),
      description: t("customer.themeDarkNote"),
      Icon: Moon,
    },
    {
      value: "system",
      label: t("customer.themeSystem"),
      description: t("customer.themeSystemNote"),
      Icon: Monitor,
    },
  ];
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const selected = mounted ? (theme ?? "system") : "system";

  return (
    <section
      className="mt-7 min-w-0 rounded-none border-0 border-t border-[color-mix(in_srgb,var(--foreground)_28%,var(--background))] bg-transparent pt-7 [overflow-wrap:anywhere] at-most-720:mt-6 at-most-720:pt-6"
      aria-labelledby="appearance-title"
      data-ui="theme-settings"
    >
      <h2
        className="mb-3 text-[22px] leading-[1.3] font-[650] tracking-[-0.3px]"
        id="appearance-title"
      >
        {t("customer.appearance")}
      </h2>
      <RadioGroup
        className="mt-4 grid grid-cols-3 gap-2.5 at-most-720:grid-cols-1 at-most-720:gap-2"
        value={selected}
        onValueChange={setTheme}
        disabled={!mounted}
        aria-labelledby="appearance-title"
        aria-describedby="appearance-save-note"
      >
        {options.map(({ value, label, description, Icon }) => (
          <label
            key={value}
            className="flex min-h-[76px] min-w-0 cursor-pointer items-center gap-2.5 rounded-[10px] border border-input bg-card p-3 transition-[border-color,background] duration-150 ease-[ease] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)] focus-within:outline-[3px] focus-within:outline-offset-3 focus-within:outline-[var(--theme-accent)] data-[selected=true]:border-[var(--theme-accent)] data-[selected=true]:bg-accent data-[selected=true]:shadow-[inset_0_0_0_1px_var(--theme-accent)] motion-reduce:transition-none at-most-720:min-h-[60px]"
            data-ui="theme-option"
            data-selected={selected === value}
            htmlFor={`theme-${value}`}
          >
            <Icon
              className="shrink-0 text-[var(--theme-accent)]"
              size={20}
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <strong className="text-[14px] leading-[1.4] font-[650] text-foreground">
                {label}
              </strong>
              {value === "system" && (
                <span className="text-[12px] leading-[1.4] text-muted-foreground">
                  {description}
                </span>
              )}
            </span>
            <RadioGroupItem
              className="size-[18px] shrink-0 border-[1.5px] border-muted-foreground bg-card text-[var(--theme-accent)] shadow-none data-[state=checked]:border-[var(--theme-accent)] focus-visible:border-muted-foreground data-[state=checked]:focus-visible:border-[var(--theme-accent)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none dark:bg-card [&_[data-slot=radio-group-indicator]_svg]:size-[9px] [&_[data-slot=radio-group-indicator]_svg]:fill-[var(--theme-accent)]"
              id={`theme-${value}`}
              value={value}
              aria-label={label}
            />
          </label>
        ))}
      </RadioGroup>
      <p
        id="appearance-save-note"
        className="mt-3 mb-2.5 text-[13px] leading-[1.6] text-muted-foreground"
      >
        {t("customer.themeSaved")}
      </p>
    </section>
  );
}
