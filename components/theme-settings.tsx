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
    <section className="theme-settings" aria-labelledby="appearance-title">
      <h2 id="appearance-title">{t("customer.appearance")}</h2>
      <RadioGroup
        className="theme-options"
        value={selected}
        onValueChange={setTheme}
        disabled={!mounted}
        aria-labelledby="appearance-title"
        aria-describedby="appearance-save-note"
      >
        {options.map(({ value, label, description, Icon }) => (
          <label
            key={value}
            className="theme-option"
            data-selected={selected === value}
            htmlFor={`theme-${value}`}
          >
            <Icon
              className="theme-option-icon"
              size={20}
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <span className="theme-option-text">
              <strong>{label}</strong>
              {value === "system" && (
                <span className="theme-option-description">{description}</span>
              )}
            </span>
            <RadioGroupItem
              id={`theme-${value}`}
              value={value}
              aria-label={label}
            />
          </label>
        ))}
      </RadioGroup>
      <p id="appearance-save-note" className="settings-save-note">
        {t("customer.themeSaved")}
      </p>
    </section>
  );
}
