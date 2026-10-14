"use client";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { appButton, errorClassName } from "@/lib/presentation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function DeferredStatus({
  error,
  pending,
  retry,
  loadingText,
  errorText,
  retryText,
  completedFocusRef,
  loadingIndicator,
  errorClassName: errorPresentation,
  loadingClassName,
}: {
  error: boolean;
  pending: boolean;
  retry: () => void;
  loadingText?: string;
  errorText?: string;
  retryText?: string;
  completedFocusRef?: RefObject<HTMLElement | null>;
  loadingIndicator?: ReactNode;
  errorClassName?: string;
  loadingClassName?: string;
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
        <p className={cn(errorClassName, errorPresentation)} role="alert">
          {errorText ?? t("customer.tryAgain")}
        </p>
      )}
      {pending &&
        (loadingIndicator ?? (
          <p className={loadingClassName} role="status">
            {loadingText ?? t("customer.loading")}
          </p>
        ))}
      {error && (
        <button
          ref={button}
          className={appButton({ variant: "outline" })}
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
