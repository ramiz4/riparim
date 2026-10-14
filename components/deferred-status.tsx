"use client";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useI18n } from "@/lib/i18n/client";

export function DeferredStatus({
  error,
  pending,
  retry,
  loadingText,
  errorText,
  retryText,
  completedFocusRef,
  loadingIndicator,
}: {
  error: boolean;
  pending: boolean;
  retry: () => void;
  loadingText?: string;
  errorText?: string;
  retryText?: string;
  completedFocusRef?: RefObject<HTMLElement | null>;
  loadingIndicator?: ReactNode;
}) {
  const { t } = useI18n(),
    button = useRef<HTMLButtonElement>(null),
    restore = useRef<string | null>(null);
  useEffect(() => {
    const moved = (event: FocusEvent) => {
      if (event.target !== document.body && event.target !== button.current)
        restore.current = null;
    };
    document.addEventListener("focusin", moved);
    return () => document.removeEventListener("focusin", moved);
  }, []);
  useEffect(() => {
    if (pending || !restore.current) return;
    const href = restore.current;
    restore.current = null;
    if (
      href === window.location.href &&
      document.activeElement === document.body &&
      !button.current?.disabled
    )
      (button.current ?? completedFocusRef?.current)?.focus();
  }, [pending, error, completedFocusRef]);
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {errorText ?? t("customer.tryAgain")}
        </p>
      )}
      {pending &&
        (loadingIndicator ?? (
          <p role="status">{loadingText ?? t("customer.loading")}</p>
        ))}
      {error && (
        <button
          ref={button}
          className="outline"
          disabled={pending}
          onClick={() => {
            restore.current =
              document.activeElement === button.current
                ? window.location.href
                : null;
            retry();
          }}
        >
          {pending
            ? t("customer.loading")
            : (retryText ?? t("customer.refresh"))}
        </button>
      )}
    </>
  );
}
