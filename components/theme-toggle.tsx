"use client";

import {useI18n} from "@/lib/i18n/client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";

const subscribe = () => () => {};

export function ThemeToggle() {
  const {t}=useI18n();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const followsSystem = !mounted || theme === "system";

  return (
    <div className="theme-control" data-mounted={mounted}>
      <span className="theme-switch-shell">
        <Switch
          className="theme-switch"
          aria-label={t("common.darkMode")}
          checked={mounted && resolvedTheme === "dark"}
          disabled={!mounted}
          onCheckedChange={checked => setTheme(checked ? "dark" : "light")}
          title={followsSystem ? t("common.themeSystem") : t("common.themeToggle")}
        />
        <span className="theme-switch-glyph" aria-hidden="true">
          <Sun className="theme-sun" size={18} strokeWidth={2} />
          <Moon className="theme-moon" size={17} strokeWidth={2} />
        </span>
      </span>
    </div>
  );
}
