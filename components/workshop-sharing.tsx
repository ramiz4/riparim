"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Copy, Printer, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/lib/i18n/client";
import { appButton, helpTextClassName } from "@/lib/presentation";
import { cn } from "@/lib/utils";
import { profilePrintFrame, publicProfileShare } from "@/lib/profile-sharing";
import type { Workshop } from "@/lib/workshops";

export function WorkshopSharing({
  workshop,
  publicOrigin,
}: {
  workshop: Pick<Workshop, "id" | "name" | "status">;
  publicOrigin?: string;
}) {
  const { locale, t } = useI18n();
  const payload = publicProfileShare(workshop, locale, publicOrigin);
  const [feedback, setFeedback] = useState<
    "copied" | "opened" | "manual" | "printError" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false),
    card = useRef<HTMLElement>(null),
    frame = useRef<HTMLIFrameElement | null>(null);
  const linkId = useId();
  useEffect(
    () => () => {
      frame.current?.remove();
    },
    [],
  );
  if (!payload) return null;
  const shareData = payload;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareData.url);
      setFeedback("copied");
    } catch {
      setFeedback("manual");
    }
  }
  async function share() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      if (typeof navigator.share !== "function") await copy();
      else {
        try {
          await navigator.share(shareData);
          setFeedback("opened");
        } catch (error) {
          if (!(
            error &&
            typeof error === "object" &&
            "name" in error &&
            error.name === "AbortError"
          ))
            await copy();
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="border-t border-border py-4"
      data-ui="profile-sharing"
      aria-label={t("sharing.share")}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            appButton({ variant: "outline" }),
            "min-h-11 flex-1 whitespace-normal",
          )}
          onClick={() => void share()}
          disabled={busy}
        >
          <Share2 size={16} aria-hidden="true" />
          {t("sharing.share")}
        </button>
        <button
          type="button"
          className={cn(
            appButton({ variant: "outline" }),
            "min-h-11 flex-1 whitespace-normal",
          )}
          onClick={() => void copy()}
          disabled={busy}
        >
          <Copy size={16} aria-hidden="true" />
          {t("sharing.copy")}
        </button>
      </div>
      <p className={helpTextClassName} role="status" aria-live="polite">
        {feedback ? t(`sharing.${feedback}`) : ""}
      </p>
      {feedback === "manual" && (
        <div className="my-3">
          <label htmlFor={linkId} className="text-sm">
            {t("sharing.link")}
          </label>
          <input
            id={linkId}
            className="mt-1 min-h-11 w-full min-w-0 rounded border border-border bg-background px-2 text-sm"
            readOnly
            value={payload.url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer py-2 text-sm underline underline-offset-4">
          {t("sharing.card")}
        </summary>
        <article
          ref={card}
          lang={locale}
          data-ui="profile-print-card"
          className="mt-3 rounded-lg border border-[#888] bg-white p-4 text-center text-black"
        >
          <h2 className="m-0 mb-3 text-xl font-semibold [overflow-wrap:anywhere]">
            {payload.title}
          </h2>
          <QRCodeSVG
            className="mx-auto h-auto max-w-full"
            value={payload.url}
            size={192}
            level="M"
            marginSize={4}
            title={t("sharing.qr", { name: payload.title })}
            role="img"
          />
          <p className="mt-3 text-sm">{t("sharing.scan")}</p>
          <a
            className="mt-2 block text-sm text-black underline [overflow-wrap:anywhere]"
            href={payload.url}
          >
            {payload.url}
          </a>
        </article>
        <button
          type="button"
          className={cn(
            appButton({ variant: "outline" }),
            "mt-3 min-h-11 w-full whitespace-normal",
          )}
          onClick={() => {
            frame.current?.remove();
            frame.current = card.current
              ? profilePrintFrame(card.current, payload.title)
              : null;
            setFeedback(frame.current ? null : "printError");
          }}
        >
          <Printer size={16} aria-hidden="true" />
          {t("sharing.print")}
        </button>
      </details>
    </section>
  );
}
