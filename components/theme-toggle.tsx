"use client";

import { useI18n } from "@/lib/i18n/client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

export function ThemeToggle({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useI18n();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const followsSystem = !mounted || theme === "system";

  return (
    <div
      className="group/theme flex shrink-0 items-center gap-1"
      data-slot="theme-control"
      data-mounted={mounted}
    >
      <span
        className={cn(
          "relative flex h-11 w-16 items-center",
          compact && "at-most-540:w-11",
        )}
        data-slot="theme-shell"
      >
        <Switch
          className={cn(
            "h-9 w-16 border-[#d7e3df] p-[3px] [background:linear-gradient(135deg,#edf3ef,#e1ece7)] [box-shadow:inset_0_1px_3px_#183b3310] [transition:background_0.25s_ease,border-color_0.25s_ease,box-shadow_0.2s_ease] hover:border-[#9fc7bb] hover:[box-shadow:0_0_0_3px_#096e6108] disabled:opacity-100 data-[state=checked]:border-[#d7e3df] data-[state=checked]:bg-transparent dark:border-input dark:[background:linear-gradient(135deg,#16363b,#21464b)] dark:data-[state=checked]:border-input",
            compact && "at-most-540:size-11 at-most-540:p-[7px]",
          )}
          thumbClassName={cn(
            "size-7 bg-white [box-shadow:0_2px_5px_#173b3324] [transition:translate_0.35s_cubic-bezier(0.22,1,0.36,1),background_0.25s_ease] data-[state=checked]:[translate:28px] dark:bg-background dark:group-data-[mounted=false]/theme:[translate:28px]",
            compact &&
              "at-most-540:bg-transparent at-most-540:shadow-none at-most-540:data-[state=checked]:[translate:0] at-most-540:dark:bg-background at-most-540:dark:group-data-[mounted=false]/theme:[translate:0]",
          )}
          aria-label={t("common.darkMode")}
          checked={mounted && resolvedTheme === "dark"}
          disabled={!mounted}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          title={
            followsSystem ? t("common.themeSystem") : t("common.themeToggle")
          }
        />
        <span
          className={cn(
            "pointer-events-none absolute top-2 left-1 grid size-7 place-items-center [transition:transform_0.35s_cubic-bezier(0.22,1,0.36,1)] dark:[transform:translateX(28px)] [&>svg]:[grid-area:1/1] [&>svg]:[transition:opacity_0.2s_ease,transform_0.35s_cubic-bezier(0.22,1,0.36,1)]",
            compact && "at-most-540:left-2 at-most-540:dark:[transform:none]",
          )}
          data-slot="theme-glyph"
          aria-hidden="true"
        >
          <Sun
            className="text-[#a46c12] opacity-100 [transform:rotate(0)_scale(1)] dark:opacity-0 dark:[transform:rotate(90deg)_scale(0.5)]"
            size={18}
            strokeWidth={2}
          />
          <Moon
            className="text-[#80ddc9] opacity-0 [transform:rotate(-45deg)_scale(0.5)] dark:opacity-100 dark:[transform:rotate(0)_scale(1)]"
            size={17}
            strokeWidth={2}
          />
        </span>
      </span>
    </div>
  );
}
