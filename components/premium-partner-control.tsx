"use client";
import { dialogCopyClassName } from "@/lib/presentation";
import { cn } from "@/lib/utils";
import {
  appButton,
  helpTextClassName,
  errorClassName,
} from "@/lib/presentation";
import { Crown } from "lucide-react";
import { useState } from "react";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { useI18n } from "@/lib/i18n/client";
import { responseError, type CodedResponse } from "@/lib/i18n/codes";
import { Dialog, DialogClose } from "./ui/dialog";
import { ModalContent } from "./modal-shell";
import { Checkbox } from "./ui/checkbox";
import type { Workshop } from "@/lib/workshops";
export function PremiumPartnerControl({ workshop }: { workshop: Workshop }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(false),
    [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useNavigationGuard({ busy: open && (busy || loading) });
  async function show() {
    setOpen(true);
    setLoading(true);
    setLoaded(false);
    setError("");
    try {
      const response = await fetch(
          `/api/premium-workshops?admin=1&workshop=${encodeURIComponent(workshop.id)}`,
        ),
        data = (await response.json()) as CodedResponse & { active: boolean };
      if (!response.ok) throw responseError(t, data);
      if (typeof data.active !== "boolean")
        throw Error("Invalid placement state");
      setActive(data.active);
      setLoaded(true);
    } catch {
      setError(t("common.unavailable"));
    } finally {
      setLoading(false);
    }
  }
  async function save() {
    if (loading || busy || !loaded) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/premium-workshops", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workshop: workshop.id, active }),
        }),
        data = (await response.json()) as CodedResponse;
      if (!response.ok) throw responseError(t, data);
      setOpen(false);
    } catch {
      setError(t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        data-ui="text-action premium-control"
        type="button"
        className={cn(
          appButton({ variant: "text" }),
          "m-0 inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap",
        )}
        onClick={() => void show()}
      >
        <Crown size={15} aria-hidden="true" />
        {t("management.premiumManage")}
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy && !loading) setOpen(value);
        }}
      >
        <ModalContent
          title={t("management.premiumManage")}
          description={workshop.name}
          closeDisabled={busy || loading}
          footer={
            <>
              <DialogClose asChild>
                <button
                  className={cn(
                    appButton({ variant: "outline" }),
                    "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:px-[13px]",
                  )}
                  disabled={busy || loading}
                >
                  {t("management.cancel")}
                </button>
              </DialogClose>
              <button
                className={cn(
                  appButton(),
                  "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:flex-1",
                )}
                disabled={loading || busy || !loaded}
                onClick={() => void save()}
              >
                {busy ? t("management.saving") : t("management.premiumSave")}
              </button>
            </>
          }
        >
          <p className={dialogCopyClassName}>{t("management.premiumHelp")}</p>
          {loading ? (
            <p className={dialogCopyClassName} role="status">
              {t("management.loading")}
            </p>
          ) : (
            <label className="flex items-center gap-3">
              <Checkbox
                checked={active}
                disabled={
                  busy ||
                  !loaded ||
                  (workshop.status !== "published" && !active)
                }
                onCheckedChange={(value) => setActive(value === true)}
                aria-label={t("management.premiumActive")}
              />
              <span className="text-[14px] text-[#506a48] dark:text-[var(--theme-accent)] at-most-720:leading-[1.5]">
                {t("management.premiumActive")}
              </span>
            </label>
          )}
          {workshop.status !== "published" && (
            <p className={cn(helpTextClassName, "leading-[1.65]")}>
              {t("management.premiumPublishedOnly")}
            </p>
          )}
          {error && (
            <div>
              <p className={cn(errorClassName, "leading-[1.65]")} role="alert">
                {error}
              </p>
              {!loaded && (
                <button
                  className={appButton({ variant: "outline" })}
                  disabled={busy}
                  onClick={() => void show()}
                >
                  {t("common.retry")}
                </button>
              )}
            </div>
          )}
        </ModalContent>
      </Dialog>
    </>
  );
}
