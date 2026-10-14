"use client";
import { useI18n } from "@/lib/i18n/client";
import { LocaleAnchor } from "@/components/locale-anchor";
import { cn } from "@/lib/utils";
// Use the same localized client navigation as the other app destinations.
export function Brand({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useI18n();
  return (
    <LocaleAnchor
      className="flex min-h-11 shrink-0 items-center gap-[10px] text-[28px] font-[750] leading-none tracking-[-1.3px] text-[#172e32] dark:text-foreground at-most-720:gap-2 at-most-720:text-[24px] at-most-380:text-[22px]"
      href="/"
      aria-label={t("common.homeLabel")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- The compact, fixed-size logo is already optimized and served as the same static asset by every runtime. */}
      <img
        className={cn(
          "block h-10 w-[170px] object-cover object-center dark:[filter:brightness(0)_invert(1)] at-most-720:h-[35px] at-most-720:w-[145px] at-most-380:h-8 at-most-380:w-[135px]",
          compact && "at-most-380:h-7 at-most-380:w-28",
        )}
        src="/riparim-logo-display.png"
        width={512}
        height={195}
        alt="riparim"
      />
    </LocaleAnchor>
  );
}
