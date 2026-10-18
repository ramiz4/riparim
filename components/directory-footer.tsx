"use client";
import { useI18n } from "@/lib/i18n/client";
import { LocaleAnchor } from "@/components/locale-anchor";
import { useState } from "react";
import Link from "@/components/locale-link";
import {
  BookOpen,
  ChevronRight,
  FileCheck2,
  LockKeyhole,
  Settings,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ModalContent } from "@/components/modal-shell";
import { cn } from "@/lib/utils";
import { pageFrameClassName, helpTextClassName } from "@/lib/presentation";

const footerActionClassName =
  "inline-flex min-h-11 items-center justify-center text-[13px] hover:text-[var(--theme-accent)] at-most-720:flex at-most-720:min-h-20 at-most-720:w-full at-most-720:min-w-0 at-most-720:flex-col at-most-720:items-start at-most-720:justify-start at-most-720:gap-2 at-most-720:rounded-xl at-most-720:border at-most-720:border-border at-most-720:bg-card at-most-720:p-3 at-most-720:text-left at-most-720:font-[550] at-most-720:leading-[1.4] at-most-720:text-foreground at-most-720:hover:border-input at-most-720:hover:bg-[var(--theme-hover)] at-most-720:focus-visible:[outline:3px_solid_var(--ring)] at-most-720:focus-visible:outline-offset-[3px] at-most-720:[&>span]:min-w-0 at-most-720:[&>span]:[overflow-wrap:anywhere]";

export function DirectoryFooter({
  open,
  onOpenChange,
}: { open?: boolean; onOpenChange?: (value: boolean) => void } = {}) {
  const { t } = useI18n();
  const [localInfo, setLocalInfo] = useState(false);
  const info = open ?? localInfo,
    setInfo = onOpenChange ?? setLocalInfo;
  return (
    <Dialog open={info} onOpenChange={setInfo}>
      <div className="border-t border-[#b9ceca] bg-[#dfeae8] dark:border-[#527578] dark:bg-[#123236]">
        <footer
          className={cn(
            pageFrameClassName,
            "flex flex-wrap items-center gap-6 py-[27px] text-[13px] text-[#415b60] dark:text-[#b7cdcb] at-most-720:grid at-most-720:grid-cols-[minmax(0,1fr)] at-most-720:gap-[18px] at-most-720:pt-7 at-most-720:pb-[22px]",
          )}
        >
          <div className="mr-auto at-most-720:m-0 at-most-720:flex at-most-720:min-w-0 at-most-720:flex-col at-most-720:items-start at-most-720:gap-1 at-most-720:[&_a:focus-visible]:[outline:3px_solid_var(--ring)] at-most-720:[&_a:focus-visible]:outline-offset-[3px]">
            <Brand />
            <p className="m-0 hidden max-w-full text-[14px] leading-[1.5] text-muted-foreground at-most-720:block">
              {t("public.tagline")}
            </p>
          </div>
          <nav
            className="flex items-center gap-6 text-inherit dark:text-muted-foreground at-most-720:grid at-most-720:min-w-0 at-most-720:grid-cols-2 at-most-720:items-stretch at-most-720:gap-[10px]"
            aria-label={t("public.footerNavigation")}
          >
            <Link
              className={cn(
                footerActionClassName,
                "at-most-720:col-span-full at-most-720:min-h-[52px] at-most-720:flex-row at-most-720:items-center at-most-720:gap-[10px] at-most-720:px-3 at-most-720:py-[10px] at-most-720:[&>span]:flex-1",
              )}
              href="/einstellungen"
            >
              <Settings
                className="hidden text-[var(--theme-accent)] at-most-720:block"
                size={20}
                aria-hidden="true"
              />
              <span>{t("common.settings")}</span>
              <ChevronRight
                className="hidden text-[var(--theme-accent)] at-most-720:block"
                size={18}
                aria-hidden="true"
              />
            </Link>
            <Link className={footerActionClassName} href="/guides">
              <BookOpen
                className="hidden text-[var(--theme-accent)] at-most-720:block"
                size={20}
                aria-hidden="true"
              />
              <span>{t("public.guides")}</span>
            </Link>
            <DialogTrigger asChild>
              <button className={footerActionClassName} type="button">
                <FileCheck2
                  className="hidden text-[var(--theme-accent)] at-most-720:block"
                  size={20}
                  aria-hidden="true"
                />
                <span>{t("public.sourcesProof")}</span>
              </button>
            </DialogTrigger>
            <Link className={footerActionClassName} href="/datenschutz">
              <LockKeyhole
                className="hidden text-[var(--theme-accent)] at-most-720:block"
                size={20}
                aria-hidden="true"
              />
              <span>{t("public.privacy")}</span>
            </Link>
          </nav>
          <span className="text-[13px] at-most-720:w-auto at-most-720:border-t at-most-720:border-border at-most-720:pt-4 at-most-720:text-[12px] at-most-720:leading-[1.5] at-most-720:text-muted-foreground">
            © 2026 Riparim
          </span>
        </footer>
      </div>
      <ModalContent
        data-ui="sources-dialog"
        title={t("public.sourcesProof")}
        description={t("public.proofDescription")}
      >
        <section className="border-t border-[#e1e9ea] pt-[15px] first:border-t-0 first:pt-0 dark:border-border">
          <h3 className="mb-[6px] text-[16px] font-[650]">
            {t("public.businessInfo")}
          </h3>
          <p className="text-[14px] leading-[1.65] text-[#566c71] dark:text-muted-foreground">
            {t("public.businessInfoHelp")}
          </p>
        </section>
        <section className="border-t border-[#e1e9ea] pt-[15px] first:border-t-0 first:pt-0 dark:border-border">
          <h3 className="mb-[6px] text-[16px] font-[650]">
            {t("public.reviews")}
          </h3>
          <p className="text-[14px] leading-[1.65] text-[#566c71] dark:text-muted-foreground">
            {t("public.proofHelp")}
          </p>
        </section>
        <section className="border-t border-[#e1e9ea] pt-[15px] first:border-t-0 first:pt-0 dark:border-border">
          <h3 className="mb-[6px] text-[16px] font-[650]">
            {t("public.directContact")}
          </h3>
          <p className="text-[14px] leading-[1.65] text-[#566c71] dark:text-muted-foreground">
            {t("public.directContactHelp")}
          </p>
        </section>
        <section className="border-t border-[#e1e9ea] pt-[15px] first:border-t-0 first:pt-0 dark:border-border">
          <h3 className="mb-[6px] text-[16px] font-[650]">
            {t("public.yourData")}
          </h3>
          <p className="text-[14px] leading-[1.65] text-[#566c71] dark:text-muted-foreground">
            {t("public.yourDataHelp")}
          </p>
        </section>
        <p className={helpTextClassName}>
          {t("public.cityCentres")}
          <LocaleAnchor
            href="https://www.geonames.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            GeoNames
          </LocaleAnchor>
          .
        </p>
      </ModalContent>
    </Dialog>
  );
}
