"use client";
import { cn } from "@/lib/utils";
import { pageFrameClassName } from "@/lib/presentation";
import { Building2, KeyRound, Star, Users, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { LocaleAnchor } from "@/components/locale-anchor";
export function AdminNavigation({
  active,
}: {
  active: "workshops" | "reviews" | "users" | "login" | "business";
}) {
  const { t } = useI18n();
  return (
    <nav
      className={cn(
        pageFrameClassName,
        "mb-1 flex flex-wrap items-center text-[#65746e] dark:text-muted-foreground gap-7 border-b border-[#dce6e7] pt-1.5 dark:border-border at-most-720:flex-nowrap at-most-720:gap-[19px] at-most-720:overflow-x-auto at-most-720:pt-0.5",
      )}
      data-ui="admin-navigation"
      aria-label={t("management.administration")}
    >
      <LocaleAnchor
        className="inline-flex items-center gap-2 border-b-2 border-transparent pt-4 pb-3.5 text-[14px] font-[550] text-[#71817f] aria-[current=page]:border-[#16846b] aria-[current=page]:text-[#166b56] dark:text-muted-foreground dark:aria-[current=page]:border-[var(--theme-accent)] dark:aria-[current=page]:text-[var(--theme-accent)] at-most-720:py-[13px] at-most-720:text-[13px] at-most-720:whitespace-nowrap"
        href="/verwaltung"
        aria-current={active === "workshops" ? "page" : undefined}
      >
        <Wrench className="shrink-0" size={17} aria-hidden="true" />
        {t("management.workshops")}
      </LocaleAnchor>
      <LocaleAnchor
        className="inline-flex items-center gap-2 border-b-2 border-transparent pt-4 pb-3.5 text-[14px] font-[550] text-[#71817f] aria-[current=page]:border-[#16846b] aria-[current=page]:text-[#166b56] dark:text-muted-foreground dark:aria-[current=page]:border-[var(--theme-accent)] dark:aria-[current=page]:text-[var(--theme-accent)] at-most-720:py-[13px] at-most-720:text-[13px] at-most-720:whitespace-nowrap"
        href="/verwaltung/bewertungen"
        aria-current={active === "reviews" ? "page" : undefined}
      >
        <Star className="shrink-0" size={17} aria-hidden="true" />
        {t("management.moderateReviews")}
      </LocaleAnchor>
      <LocaleAnchor
        className="inline-flex items-center gap-2 border-b-2 border-transparent pt-4 pb-3.5 text-[14px] font-[550] text-[#71817f] aria-[current=page]:border-[#16846b] aria-[current=page]:text-[#166b56] dark:text-muted-foreground dark:aria-[current=page]:border-[var(--theme-accent)] dark:aria-[current=page]:text-[var(--theme-accent)] at-most-720:py-[13px] at-most-720:text-[13px] at-most-720:whitespace-nowrap"
        href="/verwaltung/benutzer"
        aria-current={active === "users" ? "page" : undefined}
      >
        <Users className="shrink-0" size={17} aria-hidden="true" />
        {t("management.users")}
      </LocaleAnchor>
      <LocaleAnchor
        className="inline-flex items-center gap-2 border-b-2 border-transparent pt-4 pb-3.5 text-[14px] font-[550] text-[#71817f] aria-[current=page]:border-[#16846b] aria-[current=page]:text-[#166b56] dark:text-muted-foreground dark:aria-[current=page]:border-[var(--theme-accent)] dark:aria-[current=page]:text-[var(--theme-accent)] at-most-720:py-[13px] at-most-720:text-[13px] at-most-720:whitespace-nowrap"
        href="/verwaltung/betriebe"
        aria-current={active === "business" ? "page" : undefined}
      >
        <Building2 className="shrink-0" size={17} aria-hidden="true" />
        {t("management.businesses")}
      </LocaleAnchor>
      <LocaleAnchor
        className="inline-flex items-center gap-2 border-b-2 border-transparent pt-4 pb-3.5 text-[14px] font-[550] text-[#71817f] aria-[current=page]:border-[#16846b] aria-[current=page]:text-[#166b56] dark:text-muted-foreground dark:aria-[current=page]:border-[var(--theme-accent)] dark:aria-[current=page]:text-[var(--theme-accent)] at-most-720:py-[13px] at-most-720:text-[13px] at-most-720:whitespace-nowrap"
        href="/verwaltung/anmeldung"
        aria-current={active === "login" ? "page" : undefined}
      >
        <KeyRound className="shrink-0" size={17} aria-hidden="true" />
        {t("management.loginRegistration")}
      </LocaleAnchor>
    </nav>
  );
}
