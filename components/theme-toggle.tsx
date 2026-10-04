"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const followsSystem = !mounted || theme === "system";

  return (
    <div className="theme-control" data-mounted={mounted}>
      <span className="theme-switch-shell">
        <Switch
          className="theme-switch"
          aria-label="Dark Mode"
          checked={mounted && resolvedTheme === "dark"}
          disabled={!mounted}
          onCheckedChange={checked => setTheme(checked ? "dark" : "light")}
          title={followsSystem ? "Dark Mode · folgt dem System" : "Dark Mode umschalten"}
        />
        <span className="theme-switch-glyph" aria-hidden="true">
          <Sun className="theme-sun" size={18} strokeWidth={2} />
          <Moon className="theme-moon" size={17} strokeWidth={2} />
        </span>
      </span>
    </div>
  );
}
