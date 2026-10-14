"use client";
import { LocaleAnchor } from "@/components/locale-anchor";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/lib/i18n/client";
import { valueLabel } from "@/lib/i18n/values";
import { localizeHref } from "@/lib/i18n/locale";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { useEffect, useState } from "react";
import {
  usePublicSession,
  invalidatePublicSession,
} from "./use-public-session";
import {
  FileCheck2,
  ChevronDown,
  UserRound,
  LayoutDashboard,
  LogOut,
  LoaderCircle,
  Settings,
  Building2,
  LogIn,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { appButton, pageFrameClassName } from "@/lib/presentation";
import type { AccountIdentity } from "./account-storage-notice";

const menuItemClassName =
  "min-h-11 cursor-pointer gap-[11px] rounded-lg px-3 py-[10px] text-[14px] focus:bg-[#edf6f3] focus:text-[#096e61] data-[highlighted]:bg-[#edf6f3] data-[highlighted]:text-[#096e61] dark:focus:bg-accent dark:focus:text-[var(--theme-accent)] dark:data-[highlighted]:bg-accent dark:data-[highlighted]:text-[var(--theme-accent)] [&_svg:not([class*='size-'])]:size-[18px] [&_svg:not([class*='text-'])]:text-[#5c7574] dark:[&_svg:not([class*='text-'])]:text-muted-foreground";

type Props = {
  account: AccountIdentity | null;
  isAdmin?: boolean;
  publicSnapshot?: boolean;
  hero?: boolean;
};
export function SiteHeader({
  account: initialAccount,
  isAdmin: initialAdmin = false,
  publicSnapshot = false,
  hero = false,
}: Props) {
  const {
    account,
    isAdmin,
    pending: sessionPending,
    error: sessionError,
  } = usePublicSession(
    { account: initialAccount, isAdmin: initialAdmin },
    publicSnapshot,
  );
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [scrolled, setScrolled] = useState(false);
  // Synchronize restored scroll position and subscribe to the external viewport.
  useEffect(() => {
    let current = false;
    const update = () => {
      const next = window.scrollY > 8;
      if (next !== current) {
        current = next;
        setScrolled(next);
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useNavigationGuard({ busy });
  const name = account?.displayName.trim() || account?.email || "";
  const initials = name.includes("@")
    ? name.slice(0, 2)
    : name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!r.ok) throw Error(t("common.logoutFailed"));
      invalidatePublicSession({ signedOut: true });
      window.location.assign(localizeHref("/anmelden", locale));
    } catch {
      setBusy(false);
      setError(t("common.logoutFailed"));
    }
  }
  return (
    <div
      className={cn(
        "sticky top-0 z-30 border-b-0 [backdrop-filter:none] [-webkit-backdrop-filter:none] [&_a:focus-visible]:rounded-[4px] [&_a:focus-visible]:[outline:3px_solid_#00857b] [&_a:focus-visible]:outline-offset-[5px] dark:[&_a:focus-visible]:outline-ring",
        scrolled || hero
          ? "[background:rgba(255,255,255,0.96)] [box-shadow:inset_0_-1px_0_rgba(255,255,255,0.7),0_4px_18px_#00000010] dark:[background:rgba(16,43,47,0.96)] dark:[box-shadow:inset_0_-1px_0_rgba(255,255,255,0.18),0_4px_18px_#00000020] can-blur:[background:rgba(255,255,255,0.72)] can-blur:dark:[background:rgba(16,43,47,0.72)] can-blur:[backdrop-filter:blur(18px)] can-blur:[-webkit-backdrop-filter:blur(18px)] at-most-720:[backdrop-filter:blur(12px)] at-most-720:[-webkit-backdrop-filter:blur(12px)] reduced-transparency:[background:var(--card)] reduced-transparency:[backdrop-filter:none] reduced-transparency:[-webkit-backdrop-filter:none]"
          : "bg-white [box-shadow:inset_0_-1px_0_#d9e5e5] dark:bg-[#102a30] dark:[box-shadow:inset_0_-1px_0_#29494e]",
      )}
      data-ui="site-header"
      data-scrolled={scrolled}
      data-hero={hero}
    >
      <header
        className={cn(
          pageFrameClassName,
          "flex h-[var(--site-header-height)] items-center justify-between gap-7 at-most-720:gap-[10px] at-most-540:gap-1",
        )}
      >
        <Brand compact />
        <div className="ml-auto flex shrink-0 items-center gap-[14px] text-[14px] at-most-540:gap-1">
          <LanguageSwitcher
            verifiedAccount={
              !!account && ["E-Mail", "Google"].includes(account.provider ?? "")
            }
          />
          <ThemeToggle compact />
          {account ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex min-h-11 items-center gap-[10px] rounded-full border border-[#dce5e6] bg-white pt-1 pr-2 pb-1 pl-1 text-[14px] font-semibold hover:border-[#bbd6d0] hover:bg-[#f0f6f5] data-[state=open]:border-[#bbd6d0] data-[state=open]:bg-[#f0f6f5] dark:border-border dark:bg-card dark:text-foreground dark:hover:border-input dark:hover:bg-[var(--theme-hover)] dark:data-[state=open]:border-input dark:data-[state=open]:bg-[var(--theme-hover)] at-most-720:gap-[6px] at-most-720:pr-[7px] at-most-380:w-11 at-most-380:gap-0 at-most-380:p-[5px] at-most-380:[&>svg]:hidden"
                aria-label={t("common.userMenu")}
              >
                <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-[#def0e9] text-[12px] tracking-[0.03em] text-[#096e61] dark:bg-accent dark:text-[var(--theme-accent)] at-most-720:size-8">
                  {initials.toUpperCase()}
                </span>
                <span className="max-w-[130px] truncate at-most-720:max-w-[75px] at-most-720:text-[13px] at-most-540:hidden">
                  {name.includes("@")
                    ? t("common.myAccount")
                    : name.split(" ")[0]}
                </span>
                <ChevronDown size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="z-[80] w-[min(285px,calc(100vw_-_32px))] rounded-[14px] border border-[#dce5e6] bg-white p-[7px] text-[#183337] [box-shadow:0_14px_45px_#102d3224] dark:border-border dark:bg-card dark:text-foreground"
                data-ui="user-menu"
                align="end"
                sideOffset={10}
              >
                <DropdownMenuLabel className="flex flex-col gap-[2px] px-3 py-2 no-underline">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <strong
                      className="min-w-0 flex-1 truncate text-[14px] font-[650]"
                      title={name}
                    >
                      {name}
                    </strong>
                    <small className="max-w-[60%] shrink-0 truncate text-[12px] font-normal text-[#096e61] dark:text-[var(--theme-accent)]">
                      {isAdmin
                        ? t("common.admin")
                        : `${t("common.signedIn")}${account.provider ? ` · ${valueLabel(locale, "provider", account.provider)}` : ""}`}
                    </small>
                  </div>
                  <DropdownMenuItem
                    asChild
                    className="block min-h-0 rounded-[2px] p-0 text-[12px] font-normal text-muted-foreground"
                  >
                    <a
                      className="no-underline"
                      href={`mailto:${account.email}`}
                      title={account.email}
                    >
                      {account.email}
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mx-[3px] my-[6px] h-px bg-[#e4eaeb] dark:bg-border" />
                <DropdownMenuItem asChild className={menuItemClassName}>
                  <LocaleAnchor href="/bewertungen">
                    <UserRound />
                    {t("common.myReviews")}
                  </LocaleAnchor>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={menuItemClassName}>
                  <LocaleAnchor href="/betriebe">
                    <Building2 />
                    {t("common.myBusiness")}
                  </LocaleAnchor>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={menuItemClassName}>
                  <LocaleAnchor href="/antraege">
                    <FileCheck2 />
                    {t("common.myApplications")}
                  </LocaleAnchor>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="mx-[3px] my-[6px] h-px bg-[#e4eaeb] dark:bg-border" />
                    <DropdownMenuItem asChild className={menuItemClassName}>
                      <LocaleAnchor href="/verwaltung">
                        <LayoutDashboard />
                        {t("common.manage")}
                      </LocaleAnchor>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="mx-[3px] my-[6px] h-px bg-[#e4eaeb] dark:bg-border" />
                <DropdownMenuItem asChild className={menuItemClassName}>
                  <LocaleAnchor href="/einstellungen">
                    <Settings />
                    {t("common.settings")}
                  </LocaleAnchor>
                </DropdownMenuItem>
                {account.provider !== "ChatGPT" ? (
                  <DropdownMenuItem
                    className={cn(menuItemClassName, "leading-[20px]")}
                    disabled={busy}
                    onSelect={(e) => {
                      e.preventDefault();
                      void logout();
                    }}
                  >
                    {busy ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <LogOut />
                    )}
                    {busy ? t("common.loggingOut") : t("common.logout")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild className={menuItemClassName}>
                    <LocaleAnchor
                      href={`/signout-with-chatgpt?return_to=${encodeURIComponent(localizeHref("/anmelden", locale))}`}
                      target="_top"
                    >
                      <LogOut />
                      {t("common.logout")}
                    </LocaleAnchor>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : sessionPending ? (
            <span
              className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center text-inherit"
              data-ui="header-session-status"
              role="status"
              aria-label={t(
                sessionError ? "common.unavailable" : "common.checkingSession",
              )}
            >
              {sessionError ? (
                <UserRound size={18} aria-hidden="true" />
              ) : (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}
            </span>
          ) : (
            <>
              <div
                data-ui="header-auth"
                className="flex items-center gap-5 text-[15px] whitespace-nowrap at-most-1000:gap-[14px] at-most-720:hidden"
              >
                <LocaleAnchor
                  className="inline-flex min-h-11 items-center justify-center px-1 font-semibold"
                  href="/anmelden"
                >
                  {t("common.login")}
                </LocaleAnchor>
                <LocaleAnchor
                  className={cn(appButton(), "min-h-11 px-4 py-[10px]")}
                  href="/registrieren"
                >
                  {t("common.register")}
                </LocaleAnchor>
              </div>
              <LocaleAnchor
                className="hidden min-h-11 shrink-0 items-center justify-center gap-[6px] rounded-full border border-border bg-card p-[6px] text-[13px] font-semibold text-foreground whitespace-nowrap hover:border-input hover:bg-[var(--theme-hover)] [&>svg]:shrink-0 [&>svg]:text-[var(--theme-accent)] at-most-720:inline-flex at-most-480:w-11 at-most-480:p-0 at-most-480:[&>span]:sr-only"
                href="/anmelden"
              >
                <LogIn size={18} aria-hidden="true" />
                <span>{t("common.login")}</span>
              </LocaleAnchor>
            </>
          )}
        </div>
      </header>
      {error && (
        <p
          data-ui="header-error"
          className={cn(
            pageFrameClassName,
            "py-2 text-[14px] text-[#a53b34] dark:text-[var(--theme-danger)]",
          )}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
