"use client";
import { useI18n } from "@/lib/i18n/client";
import { SiteHeader } from "@/components/site-header";
import { LoaderCircle } from "lucide-react";
import { loadingStateClassName, pageFrameClassName } from "@/lib/presentation";
import { cn } from "@/lib/utils";

export default function Loading() {
  const { t } = useI18n();
  return (
    <>
      <SiteHeader account={null} publicSnapshot />
      <main
        className={cn(
          pageFrameClassName,
          "pt-6 pb-16 at-most-720:pt-[18px] at-most-720:pb-[calc(108px_+_env(safe-area-inset-bottom))]",
        )}
        data-riparim-page="workshop"
      >
        <div className={loadingStateClassName} role="status">
          <LoaderCircle
            size={18}
            className="inline-block animate-[spin_1s_linear_infinite]"
            aria-hidden="true"
          />
          {t("common.loadingProfile")}
        </div>
      </main>
    </>
  );
}
