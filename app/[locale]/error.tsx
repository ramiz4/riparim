"use client";
import { appButton, errorClassName } from "@/lib/presentation";
import { useI18n } from "@/lib/i18n/client";
export default function PageError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <main className="mx-auto my-20 flex max-w-[600px] flex-col gap-[25px] p-[30px]">
      <p className={errorClassName} role="alert">
        {t("common.unavailable")}
      </p>
      <button className={appButton()} onClick={reset}>
        {t("common.retry")}
      </button>
    </main>
  );
}
