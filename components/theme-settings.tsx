"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const subscribe = () => () => {};
const options = [
  { value: "light", label: "Hell", description: "Helles Erscheinungsbild.", Icon: Sun },
  { value: "dark", label: "Dunkel", description: "Dunkles Erscheinungsbild.", Icon: Moon },
  { value: "system", label: "System", description: "Folgt der Einstellung deines Geräts.", Icon: Monitor },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const selected = mounted ? theme ?? "system" : "system";

  return (
    <section className="theme-settings" aria-labelledby="appearance-title">
      <h2 id="appearance-title">Darstellung</h2>
      <p id="appearance-description">Wähle das Erscheinungsbild von Riparim.</p>
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
      <p className="settings-save-note">Deine Auswahl wird automatisch in diesem Browser gespeichert.</p>
    </section>
  );
}
