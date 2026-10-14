"use client";
import { useI18n } from "@/lib/i18n/client";
import { Cloud } from "lucide-react";
export type AccountIdentity = {
  email: string;
  displayName: string;
  provider?: string;
};
export function AccountStorageNotice() {
  const { t } = useI18n();
  return (
    <aside
      className="flex items-start gap-[9px] rounded-[9px] border border-[#dce7e8] bg-[#f3f7f8] px-3.5 py-3 text-[14px] dark:border-border dark:bg-[var(--theme-surface)] dark:text-muted-foreground"
      data-ui="storage-notice"
      aria-label={t("customer.privateStorage")}
    >
      <Cloud
        className="mt-0.5 text-[#568177] dark:text-[var(--theme-positive)]"
        size={18}
      />
      <p className="m-0 text-[14px] leading-[1.5]">
        {t("customer.storageNote")}
      </p>
    </aside>
  );
}
