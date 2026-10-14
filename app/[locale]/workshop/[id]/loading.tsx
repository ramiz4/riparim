"use client";
import { useI18n } from "@/lib/i18n/client";
import { SiteHeader } from "@/components/site-header";
import { LoaderCircle } from "lucide-react";

export default function Loading() {
  const { t } = useI18n();
  return (
    <>
      <SiteHeader account={null} publicSnapshot />
      <main className="workshop-page wrap">
        <div className="review-loading" role="status">
          <LoaderCircle size={18} className="spin" aria-hidden="true" />
          {t("common.loadingProfile")}
        </div>
      </main>
    </>
  );
}
