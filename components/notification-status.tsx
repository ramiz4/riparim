"use client";
import { cn } from "@/lib/utils";
import {
  appButton,
  errorClassName,
  noteClassName,
  helpTextClassName,
} from "@/lib/presentation";
import { useI18n } from "@/lib/i18n/client";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { formatDate } from "@/lib/i18n/format";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { LocaleAnchor } from "@/components/locale-anchor";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  maxNotificationAttempts,
  notificationErrorLabel,
  notificationStateLabel,
  type NotificationView,
} from "@/lib/notifications/contract";

type Queue = {
  notifications: NotificationView[];
  nextCursor: string | null;
  configured: boolean;
  error?: string;
};
export function NotificationStatus({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const { locale, t } = useI18n();
  const [queue, setQueue] = useState<Queue | null>(null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  useNavigationGuard({ busy });
  const current = useRef<Queue | null>(null),
    generation = useRef(0),
    controller = useRef<AbortController | null>(null);
  const load = useCallback(
    async (append = false) => {
      const request = ++generation.current;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
            `/api/notifications${append && current.current?.nextCursor ? `?cursor=${encodeURIComponent(current.current.nextCursor)}` : ""}`,
            { cache: "no-store", signal: abort.signal },
          ),
          data = (await response.json()) as Queue & CodedResponse;
        if (request !== generation.current) return;
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setQueue(null);
            current.current = null;
          }
          throw responseError(t, data);
        }
        const next =
          append && current.current
            ? {
                ...data,
                notifications: [
                  ...current.current.notifications,
                  ...data.notifications,
                ],
              }
            : data;
        current.current = next;
        setQueue(next);
      } catch (e) {
        if (request === generation.current && !abort.signal.aborted)
          setError(
            e instanceof TypeError
              ? t("management.notificationsNetwork")
              : e instanceof LocalizedError
                ? e.message
                : t("management.loadFailed"),
          );
      } finally {
        if (request === generation.current) setLoading(false);
      }
    },
    [t],
  );
  const cancelLoad = useCallback(() => {
    controller.current?.abort();
    generation.current++;
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh after moderation; sending happens only on explicit actions.
    void load();
    return cancelLoad;
  }, [load, refreshKey, cancelLoad]);
  async function retry(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry", id }),
        }),
        data = (await response.json()) as CodedResponse;
      if (!response.ok) throw responseError(t, data);
      await load();
      setFeedback(t("management.notificationsStarted"));
    } catch (e) {
      setError(
        e instanceof TypeError
          ? t("management.notificationCheckNetwork")
          : e instanceof LocalizedError
            ? e.message
            : t("management.notificationCheckFailed"),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      data-ui="notification-panel"
      className="mt-8 border-t border-border pt-7"
      aria-labelledby="notification-heading"
      aria-busy={loading || busy}
    >
      <div className="mb-[18px] flex items-start justify-between gap-5 at-most-720:flex-col at-most-720:gap-3.5">
        <div>
          <h2 className="mb-2 text-[22px] font-[650]" id="notification-heading">
            {t("management.notificationsTitle")}
          </h2>
          <p className="my-1.5 text-[14px] leading-[1.6] text-muted-foreground">
            {t("management.notificationsHelp")}
          </p>
        </div>
        <button
          className={cn(
            appButton({ variant: "outline" }),
            "shrink-0 at-most-720:max-w-full at-most-720:whitespace-normal px-[13px] py-2",
          )}
          disabled={loading || busy}
          onClick={() => void load()}
        >
          {t("management.refreshNotifications")}
        </button>
      </div>
      {error && (
        <p className={errorClassName} role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <p
          className="mb-4 rounded-lg bg-[#eef6e9] px-[15px] py-3 text-[14px] text-[#527d4d] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
          role="status"
        >
          {feedback}
        </p>
      )}
      {loading && !queue && (
        <p role="status">{t("management.notificationsLoading")}</p>
      )}
      {queue && !queue.configured && (
        <p className={noteClassName}>
          {t("management.notificationsSetupHelp")}
        </p>
      )}
      {queue && (
        <>
          <div className="mb-[18px] grid gap-3">
            {queue.notifications.map((item) => (
              <article
                data-ui="notification-entry"
                key={item.id}
                className="flex items-start justify-between gap-5 rounded-xl border border-border bg-card p-[18px] [overflow-wrap:anywhere] at-most-720:flex-col at-most-720:gap-3.5"
              >
                <div className="min-w-0">
                  <h3 className="text-[16px] font-[650]">
                    {item.workshopName}
                  </h3>
                  <p className="my-1.5 text-[14px] leading-[1.6] text-muted-foreground">
                    {item.decision === "published"
                      ? t("management.reviewApproval")
                      : t("management.evidenceSupplement")}{" "}
                    · {notificationStateLabel(t, item.state)}
                  </p>
                  {item.error && (
                    <p className="my-1.5 text-[14px] leading-[1.6] text-muted-foreground">
                      {notificationErrorLabel(t, item.error)}
                    </p>
                  )}
                  <p
                    className={cn(
                      helpTextClassName,
                      "my-1.5 text-[14px] leading-[1.6]",
                    )}
                  >
                    {t("management.deliveryAttempts", { count: item.attempts })}
                    {["pending", "blocked", "failed"].includes(item.state) &&
                    item.attempts < maxNotificationAttempts
                      ? t("management.nextDeliveryCheck", {
                          when: formatDate(locale, item.nextAttemptAt, {
                            withTime: true,
                          }),
                        })
                      : ""}
                  </p>
                  <LocaleAnchor
                    data-ui="text-action"
                    className={appButton({ variant: "text" })}
                    href={`/verwaltung/bewertungen?einreichung=${encodeURIComponent(item.visitId)}`}
                  >
                    {t("management.reviewRelated")}
                  </LocaleAnchor>
                </div>
                <button
                  className={cn(
                    appButton({ variant: "outline" }),
                    "shrink-0 at-most-720:max-w-full at-most-720:whitespace-normal px-[13px] py-2",
                  )}
                  disabled={busy || loading || !item.retryable}
                  onClick={() => void retry(item.id)}
                >
                  {t("management.retryNotification")}
                </button>
              </article>
            ))}
          </div>
          {!loading && !queue.notifications.length && (
            <p>{t("management.notificationsEmpty")}</p>
          )}
          {queue.nextCursor && (
            <button
              className={cn(
                appButton({ variant: "outline" }),
                "mt-3 mr-3 px-[13px] py-2",
              )}
              disabled={busy || loading}
              onClick={() => void load(true)}
            >
              {t("management.moreNotifications")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
