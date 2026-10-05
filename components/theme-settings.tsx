"use client";
import {useI18n} from "@/lib/i18n/client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const subscribe = () => () => {};


export function ThemeSettings() {
 const {t}=useI18n();
 const options = [
  { value: "light", label: t("customer.themeLight"), description: t("customer.themeLightNote"), Icon: Sun },
  { value: "dark", label: t("customer.themeDark"), description: t("customer.themeDarkNote"), Icon: Moon },
  { value: "system", label: t("customer.themeSystem"), description: t("customer.themeSystemNote"), Icon: Monitor },
];
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const selected = mounted ? theme ?? "system" : "system";

  return (
    <section className="theme-settings" aria-labelledby="appearance-title">
      <h2 id="appearance-title">{t("customer.appearance")}</h2>
      <p id="appearance-description">{t("customer.appearanceNote")}</p>
      <RadioGroup className="theme-options" value={selected} onValueChange={setTheme} disabled={!mounted} aria-labelledby="appearance-title" aria-describedby="appearance-description">
        {options.map(({ value, label, description, Icon }) => (
          <label key={value} className="theme-option" data-selected={selected === value} htmlFor={`theme-${value}`}>
            <span className="theme-option-top">
              <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
              <RadioGroupItem id={`theme-${value}`} value={value} aria-label={label} />
            </span>
            <strong>{label}</strong>
            <span className="theme-option-description">{description}</span>
          </label>
        ))}
      </RadioGroup>
      <p className="settings-save-note">{t("customer.themeSaved")}</p>
    </section>
  );
}
