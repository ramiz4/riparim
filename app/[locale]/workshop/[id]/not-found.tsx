"use client";
import { useI18n } from "@/lib/i18n/client";
import Link from "@/components/locale-link";
import { appButton } from "@/lib/presentation";
export default function WorkshopNotFound() {
  const { t } = useI18n();
  return (
    <main className="mx-auto my-20 flex max-w-[600px] flex-col gap-[25px] p-[30px]">
      <h1 className="text-[32px] leading-[1.2]">
        {t("common.profileNotAvailable")}
      </h1>
      <p className="text-[#758273] dark:text-muted-foreground">
        {t("common.profileNotAvailableHelp")}
      </p>
      <Link className={appButton()} href="/">
        {t("common.findWorkshops")}
      </Link>
    </main>
  );
}
