"use client";
import { dialogCopyClassName } from "@/lib/presentation";
import {
  dialogHeaderClassName,
  dialogTitleClassName,
  dialogDescriptionClassName,
  dialogFooterClassName,
  confirmationCancelClassName,
  confirmationActionClassName,
  pageFrameClassName,
  appButton,
  errorClassName,
  emptyStateClassName,
  emptyStateCopyClassName,
  formClassName,
  formLabelClassName,
  inputClassName,
  helpTextClassName,
  formHintClassName,
  noteClassName,
  confirmationDialogClassName,
} from "@/lib/presentation";
import { cn } from "@/lib/utils";

import { AdminLoading } from "@/components/admin-loading";
import { useI18n } from "@/lib/i18n/client";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { valueLabel } from "@/lib/i18n/values";
import { formatDate } from "@/lib/i18n/format";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";

import Link from "@/components/locale-link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Pencil,
  Search,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  Trash2,
  UserRound,
  UserRoundX,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { AdminNavigation } from "@/components/admin-navigation";
import type { AccountIdentity } from "@/components/account-storage-notice";
import type { ManagedUser } from "@/lib/user-contract";
import { ModalBody, ModalContent } from "@/components/modal-shell";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserPage = {
  users: ManagedUser[];
  pendingDeletions?: ManagedUser[];
  page: number;
  perPage: number;
  hasMore: boolean;
  configured: boolean;
  error?: string;
};
type Draft = { name: string; email: string; password: string; active: boolean };
const perPage = 20;
const providerLabels: Record<string, string> = {
  email: "E-Mail",
  google: "Google",
  chatgpt: "ChatGPT",
  apple: "Apple",
  github: "GitHub",
};

function failureMessage(error: unknown, fallback: string) {
  return error instanceof LocalizedError ? error.message : fallback;
}

export default function AdminUsers({ account }: { account: AccountIdentity }) {
  const { locale, t } = useI18n();
  function displayDate(value: string | null) {
    return value ? formatDate(locale, value) : t("management.never");
  }
  const formId = useId();
  const [pendingDeletions, setPendingDeletions] = useState<ManagedUser[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]),
    [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false),
    [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [query, setQuery] = useState("");
  const [editor, setEditor] = useState(false),
    [editing, setEditing] = useState<ManagedUser | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState("");
  const [mutating, setMutating] = useState<string | null>(null),
    [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null),
    [deleteError, setDeleteError] = useState("");
  const [roleUser, setRoleUser] = useState<ManagedUser | null>(null);
  const controller = useRef<AbortController | null>(null),
    requestGeneration = useRef(0);
  const cancelLoad = useCallback(() => {
    controller.current?.abort();
    requestGeneration.current++;
  }, []);
  const [dirty, setDirty] = useState(false);
  useNavigationGuard({ busy: saving || !!mutating, dirty: editor && dirty });
  const load = useCallback(
    async (targetPage: number) => {
      const generation = ++requestGeneration.current;
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/users?page=${targetPage}&perPage=${perPage}`,
          { signal: request.signal },
        );
        const data = (await response.json()) as UserPage & CodedResponse;
        if (generation !== requestGeneration.current) return;
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setUsers([]);
            setPendingDeletions([]);
            setLoaded(false);
            setConfigured(null);
            setHasMore(false);
          }
          throw responseError(t, data);
        }
        setPendingDeletions(data.pendingDeletions ?? []);
        setUsers(data.users);
        setPage(data.page);
        setHasMore(data.hasMore);
        setConfigured(data.configured);
        setLoaded(true);
      } catch (loadError) {
        if (generation === requestGeneration.current && !request.signal.aborted)
          setError(failureMessage(loadError, t("management.usersLoadFailed")));
      } finally {
        if (generation === requestGeneration.current) setLoading(false);
      }
    },
    [t],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mounting this authorized management page starts its remote user list load.
    void load(1);
    return cancelLoad;
  }, [load, cancelLoad]);

  function openEditor(user?: ManagedUser) {
    setDirty(false);
    setEditing(user ?? null);
    setDraft({
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      active: user?.active ?? true,
    });
    setFormError("");
    setEditor(true);
  }
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDirty(true);
    setDraft((old) => (old ? { ...old, [key]: value } : old));
    setFormError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    if (draft.name.trim().length < 2) {
      setFormError(t("management.nameMinimum"));
      return;
    }
    if (
      (!editing || draft.password.length > 0) &&
      (draft.password.length < 12 || draft.password.length > 128)
    ) {
      setFormError(t("management.passwordLength"));
      return;
    }
    setSaving(true);
    setFormError("");
    setFeedback("");
    try {
      const payload = editing
        ? {
            name: draft.name.trim(),
            ...(!editing.protected ? { email: draft.email.trim() } : {}),
            ...(draft.password ? { password: draft.password } : {}),
          }
        : {
            name: draft.name.trim(),
            email: draft.email.trim(),
            password: draft.password,
            active: draft.active,
          };
      const response = await fetch(
        editing ? `/api/users/${encodeURIComponent(editing.id)}` : "/api/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as CodedResponse & {
        user?: ManagedUser;
        error?: string;
      };
      if (!response.ok) throw responseError(t, data);
      setEditor(false);
      setDraft(null);
      setFeedback(
        editing ? t("management.userUpdated") : t("management.userCreated"),
      );
      if (!editing) setQuery("");
      await load(editing ? page : 1);
    } catch (saveError) {
      setFormError(failureMessage(saveError, t("management.userSaveFailed")));
    } finally {
      setSaving(false);
    }
  }
  async function setActive(user: ManagedUser) {
    if (user.protected || loading || saving || mutating) return;
    setMutating(user.id);
    setError("");
    setFeedback("");
    try {
      const response = await fetch(
        `/api/users/${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !user.active }),
        },
      );
      const data = (await response.json()) as CodedResponse & {
        user: ManagedUser;
        error?: string;
      };
      if (!response.ok) throw responseError(t, data);
      setUsers((old) =>
        old.map((item) => (item.id === user.id ? data.user : item)),
      );
      setFeedback(
        user.active
          ? t("management.userDisabled")
          : t("management.userEnabled"),
      );
    } catch (statusError) {
      const message = failureMessage(
        statusError,
        t("management.userStatusFailed"),
      );
      await load(page);
      setError(message);
    } finally {
      setMutating(null);
    }
  }
  async function remove() {
    if (!deleteUser || deleteUser.protected || mutating) return;
    setMutating(deleteUser.id);
    setDeleteError("");
    setFeedback("");
    try {
      const response = await fetch(
        `/api/users/${encodeURIComponent(deleteUser.id)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as CodedResponse & {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok) throw responseError(t, data);
      setDeleteUser(null);
      setFeedback(t("management.userDeleted"));
      await load(users.length === 1 && page > 1 ? page - 1 : page);
    } catch (removeError) {
      setDeleteError(
        failureMessage(removeError, t("management.userDeleteFailed")),
      );
      await load(page);
    } finally {
      setMutating(null);
    }
  }
  async function changeRole() {
    if (!roleUser || roleUser.protected || loading || saving || mutating)
      return;
    const role = roleUser.role === "admin" ? "user" : "admin";
    setMutating(roleUser.id);
    setError("");
    setFeedback("");
    try {
      const response = await fetch(
        `/api/users/${encodeURIComponent(roleUser.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      const data = (await response.json()) as CodedResponse & {
        user: ManagedUser;
        roleChanged?: boolean;
        error?: string;
      };
      if (!response.ok) throw responseError(t, data);
      setUsers((old) =>
        old.map((user) => (user.id === roleUser.id ? data.user : user)),
      );
      setRoleUser(null);
      setFeedback(
        data.roleChanged === false
          ? t("management.roleAlready")
          : t(
              data.user.role === "admin"
                ? "management.roleGranted"
                : "management.roleRevoked",
            ),
      );
    } catch (roleError) {
      const message = failureMessage(roleError, t("management.userRoleFailed"));
      // A failed response can follow a completed server write. Reload before offering another role change.
      setRoleUser(null);
      setUsers([]);
      await load(page);
      setError(message);
    } finally {
      setMutating(null);
    }
  }
  const busy = loading || saving || !!mutating;
  const shown = users.filter((user) =>
    `${user.name} ${user.email}`
      .toLocaleLowerCase(locale)
      .includes(query.trim().toLocaleLowerCase(locale)),
  );

  return (
    <>
      <SiteHeader account={account} isAdmin />
      <AdminNavigation active="users" />
      <main
        data-ui="admin-users-page"
        className={cn(pageFrameClassName, "pt-8 pb-[60px]")}
      >
        <div
          data-ui="admin-title"
          className="flex items-center justify-between gap-[30px] at-most-1000:items-start at-most-720:flex-col at-most-720:gap-[18px]"
        >
          <div>
            <h1 className="text-[32px] leading-[1.2] font-semibold tracking-[-1px] at-most-720:text-[28px] m-0">
              {t("management.manageUsers")}
            </h1>
          </div>
          <button
            className={cn(
              appButton(),
              "whitespace-nowrap at-most-1000:text-[13px] at-most-720:w-full",
            )}
            disabled={busy || configured !== true}
            onClick={() => openEditor()}
          >
            <Plus size={17} aria-hidden="true" />
            {t("management.createUser")}
          </button>
        </div>
        <div data-ui="users-toolbar" className="my-[22px] flex items-center">
          <label
            data-ui="users-search"
            className="flex min-w-0 flex-1 items-center gap-[9px] rounded-[9px] border border-border bg-card px-3.5 py-[11px] text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#35866a] at-most-720:basis-full at-most-720:p-3"
          >
            <Search size={16} aria-hidden="true" />
            <input
              className="w-full min-w-0 border-0 bg-transparent text-[14px] text-foreground outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("management.userSearchExample")}
              aria-label={t("management.userSearch")}
              disabled={configured !== true}
            />
          </label>
        </div>
        {feedback && (
          <p
            className="mb-4 rounded-lg bg-[#eef6e9] px-[15px] py-3 text-[14px] text-[#527d4d] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
            role="status"
          >
            {feedback}
          </p>
        )}
        {error && (
          <p className={cn(errorClassName, "mb-[18px]")} role="alert">
            {error}
          </p>
        )}
        {pendingDeletions.length > 0 && (
          <section
            data-ui="users-setup-note"
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-[26px] at-most-720:gap-3 at-most-720:p-[19px]"
            aria-labelledby="pending-deletions-title"
          >
            <div>
              <h2
                className="mb-2 text-[20px] font-semibold at-most-720:text-[18px]"
                id="pending-deletions-title"
              >
                {t("management.unfinishedDeletions")}
              </h2>
              <p className="max-w-[660px] text-[14px] text-muted-foreground">
                {t("management.unfinishedDeletionHelp")}
              </p>
              {pendingDeletions.map((user) => (
                <p
                  className="max-w-[660px] text-[14px] text-muted-foreground"
                  key={user.id}
                >
                  <span>{user.id}</span>{" "}
                  <button
                    className={cn(
                      appButton({ variant: "outline" }),
                      "px-[13px] py-2",
                    )}
                    disabled={busy || user.protected}
                    aria-label={t("management.finishDeletionLabel", {
                      id: user.id,
                    })}
                    onClick={() => {
                      setDeleteUser({
                        ...user,
                        name: t("management.startedDeletion", { id: user.id }),
                      });
                      setDeleteError("");
                    }}
                  >
                    {t("management.finishDeletion")}
                  </button>
                </p>
              ))}
            </div>
          </section>
        )}
        {configured === false && (
          <section
            data-ui="users-setup-note"
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-[26px] at-most-720:gap-3 at-most-720:p-[19px]"
            aria-labelledby="users-setup-title"
          >
            <ShieldCheck
              className="mt-1 text-[#35866a]"
              size={24}
              aria-hidden="true"
            />
            <div>
              <h2
                className="mb-2 text-[20px] font-semibold at-most-720:text-[18px]"
                id="users-setup-title"
              >
                {t("management.serverMissing")}
              </h2>
              <p className="max-w-[660px] text-[14px] text-muted-foreground">
                {t("management.usersSetupHelp")}
              </p>
              <Link
                data-ui="text-action"
                className={appButton({ variant: "text" })}
                href="/verwaltung/anmeldung"
              >
                {t("management.openLoginSettings")}
              </Link>
            </div>
          </section>
        )}
        {loading && !loaded && (
          <AdminLoading>{t("management.usersLoading")}</AdminLoading>
        )}
        {configured === true && (
          <>
            {loading && loaded && (
              <AdminLoading compact>
                {t("management.usersLoading")}
              </AdminLoading>
            )}
            <div
              data-ui="directory-table users-table"
              className="overflow-hidden rounded-[10px] border bg-white dark:border-border dark:bg-card dark:text-foreground at-most-720:overflow-auto border-border"
              aria-busy={loading}
            >
              <Table aria-label={t("management.userAccounts")}>
                <TableHeader>
                  <TableRow className="hover:bg-[#f8faf5] dark:hover:border-input dark:hover:bg-[var(--theme-hover)] border-border">
                    <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                      {t("management.users")}
                    </TableHead>
                    <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                      {t("management.role")}
                    </TableHead>
                    <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                      {t("management.status")}
                    </TableHead>
                    <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                      {t("management.loginMethod")}
                    </TableHead>
                    <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                      {t("management.created")}
                    </TableHead>
                    <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                      {t("management.lastLogin")}
                    </TableHead>
                    <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                      <span className="sr-only">{t("management.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((user) => (
                    <TableRow
                      className="hover:bg-[#f8faf5] dark:hover:border-input dark:hover:bg-[var(--theme-hover)] border-border"
                      key={user.id}
                    >
                      <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px] align-top first:min-w-[225px] first:max-w-80 first:whitespace-normal first:[overflow-wrap:anywhere]">
                        <strong className="block font-semibold">
                          {user.name || t("management.unnamed")}
                        </strong>
                        <span className="mt-[3px] block text-[12px] text-muted-foreground">
                          {user.email}
                        </span>
                        {user.protected && (
                          <span className="mt-2 inline-flex items-center gap-[5px] text-[11px] text-[#247655] dark:text-[var(--theme-positive)]">
                            <ShieldCheck size={12} aria-hidden="true" />
                            {t("management.protectedAccess")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px] align-top first:min-w-[225px] first:max-w-80 first:whitespace-normal first:[overflow-wrap:anywhere]">
                        <span
                          data-ui="users-role"
                          data-role={user.role}
                          className={cn(
                            "inline-flex items-center gap-[5px] rounded-[5px] px-[9px] py-[3px] text-[12px] whitespace-nowrap",
                            user.role === "admin"
                              ? "bg-[#e8f2ef] text-[#216f55] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {user.role === "admin" ? (
                            <>
                              <ShieldCheck size={13} aria-hidden="true" />
                              {t("management.adminRole")}
                            </>
                          ) : (
                            t("management.userRole")
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px] align-top first:min-w-[225px] first:max-w-80 first:whitespace-normal first:[overflow-wrap:anywhere]">
                        <span
                          data-ui="users-status"
                          data-active={user.active}
                          className={cn(
                            "inline-flex rounded-[5px] px-[9px] py-[3px] text-[12px] whitespace-nowrap",
                            user.active
                              ? "bg-[#eaf4e6] text-[#387445] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
                              : "bg-[#f4ece8] text-[#956247] dark:bg-[#3a2926] dark:text-[#e6a89b]",
                          )}
                        >
                          {user.active
                            ? t("management.active")
                            : t("management.inactive")}
                        </span>
                      </TableCell>
                      <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px] align-top first:min-w-[225px] first:max-w-80 first:whitespace-normal first:[overflow-wrap:anywhere]">
                        <span className="block">
                          {user.providers.length
                            ? user.providers
                                .map((provider) =>
                                  valueLabel(
                                    locale,
                                    "provider",
                                    providerLabels[provider] ?? provider,
                                  ),
                                )
                                .join(", ")
                            : "–"}
                        </span>
                        <span className="mt-[3px] block text-[12px] text-muted-foreground">
                          {user.confirmed
                            ? t("management.emailConfirmed")
                            : t("management.emailUnconfirmed")}
                        </span>
                      </TableCell>
                      <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px] align-top first:min-w-[225px] first:max-w-80 first:whitespace-normal first:[overflow-wrap:anywhere]">
                        {user.createdAt ? displayDate(user.createdAt) : "–"}
                      </TableCell>
                      <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px] align-top first:min-w-[225px] first:max-w-80 first:whitespace-normal first:[overflow-wrap:anywhere]">
                        {displayDate(user.lastSignInAt)}
                      </TableCell>
                      <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px] align-top first:min-w-[225px] first:max-w-80 first:whitespace-normal first:[overflow-wrap:anywhere]">
                        <div
                          data-ui="users-actions"
                          className="flex flex-col items-start gap-2.5"
                        >
                          <button
                            data-ui="text-action"
                            className={cn(
                              appButton({ variant: "text" }),
                              "inline-flex items-center gap-1.5 m-0 text-[13px] whitespace-nowrap",
                            )}
                            disabled={busy}
                            aria-label={t("management.editUserLabel", {
                              name: user.name || user.email,
                            })}
                            onClick={() => openEditor(user)}
                          >
                            <Pencil size={15} aria-hidden="true" />
                            {t("management.edit")}
                          </button>
                          <button
                            data-ui="text-action"
                            className={cn(
                              appButton({ variant: "text" }),
                              "inline-flex items-center gap-1.5 m-0 text-[13px] whitespace-nowrap",
                            )}
                            disabled={busy || user.protected}
                            title={
                              user.protected
                                ? t("management.preserveAdmin")
                                : undefined
                            }
                            aria-label={
                              user.role === "admin"
                                ? t("management.revokeRoleLabel", {
                                    name: user.name || user.email,
                                  })
                                : t("management.grantRoleLabel", {
                                    name: user.name || user.email,
                                  })
                            }
                            onClick={() => setRoleUser(user)}
                          >
                            {user.role === "admin" ? (
                              <ShieldMinus size={15} aria-hidden="true" />
                            ) : (
                              <ShieldPlus size={15} aria-hidden="true" />
                            )}
                            {user.role === "admin"
                              ? t("management.revokeAdmin")
                              : t("management.makeAdmin")}
                          </button>
                          <button
                            data-ui="text-action"
                            className={cn(
                              appButton({ variant: "text" }),
                              "inline-flex items-center gap-1.5 m-0 text-[13px] whitespace-nowrap",
                            )}
                            disabled={busy || user.protected}
                            title={
                              user.protected
                                ? t("management.protectedStaysActive")
                                : undefined
                            }
                            aria-label={t(
                              user.active
                                ? "management.disableUserLabel"
                                : "management.enableUserLabel",
                              { name: user.name || user.email },
                            )}
                            onClick={() => void setActive(user)}
                          >
                            {mutating === user.id &&
                            !deleteUser &&
                            !roleUser ? (
                              <LoaderCircle
                                size={15}
                                className="inline-block animate-spin motion-reduce:animate-none"
                                aria-hidden="true"
                              />
                            ) : user.active ? (
                              <UserRoundX size={15} aria-hidden="true" />
                            ) : (
                              <UserRoundCheck size={15} aria-hidden="true" />
                            )}
                            {user.active
                              ? t("management.disable")
                              : t("management.enable")}
                          </button>
                          <button
                            className="inline-flex items-center gap-1.5 text-[13px] font-[550] text-[#a13d35] whitespace-nowrap hover:enabled:underline hover:enabled:underline-offset-[3px] dark:text-[#e6a89b]"
                            disabled={busy || user.protected}
                            title={
                              user.protected
                                ? t("management.protectedNotDeleted")
                                : undefined
                            }
                            aria-label={t("management.deleteUserLabel", {
                              name: user.name || user.email,
                            })}
                            onClick={() => {
                              setDeleteError("");
                              setDeleteUser(user);
                            }}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            {t("management.delete")}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!loading && !error && !shown.length && (
              <div
                data-ui="users-empty"
                className={cn(
                  emptyStateClassName,
                  "mt-[18px] at-most-720:px-[18px] at-most-720:py-[30px]",
                )}
              >
                <UsersRound size={28} aria-hidden="true" />
                <h2 className="text-[20px] font-semibold at-most-720:text-[18px]">
                  {query.trim()
                    ? t("management.noMatchingUsers")
                    : t("management.noUsers")}
                </h2>
                <p className={emptyStateCopyClassName}>
                  {query.trim()
                    ? t("management.userSearchHelp")
                    : t("management.createUserHelp")}
                </p>
                {!query.trim() && (
                  <button
                    className={appButton({ variant: "outline" })}
                    disabled={busy}
                    onClick={() => openEditor()}
                  >
                    {t("management.createUser")}
                  </button>
                )}
              </div>
            )}
            <nav
              data-ui="users-pagination"
              className="mt-[22px] flex items-center justify-between gap-[18px] text-[#65746e] dark:text-muted-foreground at-most-720:flex-wrap at-most-720:gap-2.5"
              aria-label={t("management.userPages")}
            >
              <button
                className={cn(
                  appButton({ variant: "outline" }),
                  "px-[13px] py-2",
                )}
                disabled={busy || page === 1}
                onClick={() => {
                  setQuery("");
                  void load(page - 1);
                }}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                {t("management.back")}
              </button>
              <span className="text-center text-[13px] text-muted-foreground at-most-720:order-3 at-most-720:w-full">
                {t("management.userPageSummary", { page, count: users.length })}
                {query.trim()
                  ? t("management.userMatches", { count: shown.length })
                  : ""}
              </span>
              <button
                className={cn(
                  appButton({ variant: "outline" }),
                  "px-[13px] py-2",
                )}
                disabled={busy || !hasMore}
                onClick={() => {
                  setQuery("");
                  void load(page + 1);
                }}
              >
                {t("management.next")}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          </>
        )}
      </main>
      <Dialog
        open={editor}
        onOpenChange={(open) => {
          if (!saving) {
            setEditor(open);
            if (!open) setDraft(null);
          }
        }}
      >
        <ModalContent
          closeDisabled={saving}
          title={
            editing ? t("management.editUser") : t("management.createUser")
          }
          description={
            editing ? t("management.editUserHelp") : t("management.newUserHelp")
          }
          footer={
            <>
              <DialogClose asChild>
                <button
                  className={cn(
                    appButton({ variant: "outline" }),
                    "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:px-[13px]",
                  )}
                  disabled={saving}
                >
                  {t("management.cancel")}
                </button>
              </DialogClose>
              <button
                className={cn(
                  appButton(),
                  "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:flex-1",
                )}
                disabled={saving || !draft}
                type="submit"
                form={formId}
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="inline-block animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    {t("management.saving")}
                  </>
                ) : editing ? (
                  t("management.saveChanges")
                ) : (
                  t("management.createUser")
                )}
              </button>
            </>
          }
        >
          {draft && (
            <form
              data-ui="users-form"
              id={formId}
              className={formClassName}
              onSubmit={save}
            >
              <fieldset
                className="m-0 flex min-w-0 flex-col gap-[18px] border-0 p-0"
                disabled={saving}
              >
                <label className={formLabelClassName}>
                  {t("management.name")}
                  <input
                    className={cn(
                      inputClassName,
                      "disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground",
                    )}
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    value={draft.name}
                    onChange={(event) => change("name", event.target.value)}
                  />
                </label>
                <label className={formLabelClassName}>
                  {t("management.emailAddress")}
                  <input
                    className={cn(
                      inputClassName,
                      "disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground",
                    )}
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    disabled={editing?.protected}
                    value={draft.email}
                    onChange={(event) => change("email", event.target.value)}
                  />
                </label>
                {editing?.protected && (
                  <p
                    className={cn(
                      cn(helpTextClassName, "-mt-[9px] text-[13px]"),
                      "leading-[1.65]",
                    )}
                  >
                    {t("management.protectedEmail")}
                  </p>
                )}
                <label className={formLabelClassName}>
                  {editing
                    ? t("management.newPassword")
                    : t("management.password")}
                  {editing && (
                    <span className={formHintClassName}>
                      {" "}
                      {t("management.optional")}
                    </span>
                  )}
                  <input
                    className={cn(
                      inputClassName,
                      "disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground",
                    )}
                    type="password"
                    required={!editing}
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    value={draft.password}
                    onChange={(event) => change("password", event.target.value)}
                    aria-describedby={`${formId}-password-help`}
                  />
                </label>
                <p
                  className={cn(
                    cn(helpTextClassName, "-mt-[9px] text-[13px]"),
                    "leading-[1.65]",
                  )}
                  id={`${formId}-password-help`}
                >
                  {editing
                    ? t("management.passwordKeepHelp")
                    : t("management.passwordHelp")}
                </p>
                {!editing && (
                  <>
                    <label className="flex items-center gap-3 rounded-lg border border-border bg-card p-[15px]">
                      <Switch
                        checked={draft.active}
                        onCheckedChange={(active) => change("active", active)}
                        aria-label={t("management.activateNewUser")}
                      />
                      <span
                        className={cn(
                          formHintClassName,
                          "dark:text-[var(--theme-accent)] at-most-720:leading-[1.5] flex flex-col gap-[3px] text-[14px] text-foreground",
                        )}
                      >
                        <strong>{t("management.activateAccount")}</strong>
                        <span className="text-[12px] font-normal text-muted-foreground">
                          {t("management.disabledLogin")}
                        </span>
                      </span>
                    </label>
                    <p
                      className={cn(
                        cn(helpTextClassName, "-mt-[9px] text-[13px]"),
                        "leading-[1.65]",
                      )}
                    >
                      {t("management.createdUserRights")}
                    </p>
                  </>
                )}
                {editing?.protected && (
                  <div className={noteClassName}>
                    <UserRound size={18} aria-hidden="true" />
                    <p className={dialogCopyClassName}>
                      {t("management.protectedUser")}
                    </p>
                  </div>
                )}
              </fieldset>
              {formError && (
                <p
                  className={cn(errorClassName, "leading-[1.65]")}
                  role="alert"
                >
                  {formError}
                </p>
              )}
            </form>
          )}
        </ModalContent>
      </Dialog>
      <AlertDialog
        open={!!roleUser}
        onOpenChange={(open) => {
          if (!open && !mutating) setRoleUser(null);
        }}
      >
        <AlertDialogContent
          data-ui="user-role-dialog"
          className={confirmationDialogClassName}
        >
          <AlertDialogHeader className={dialogHeaderClassName}>
            <AlertDialogTitle className={dialogTitleClassName}>
              {roleUser?.role === "admin"
                ? t("management.revokeAdminTitle")
                : t("management.grantAdminTitle")}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <ModalBody>
            <AlertDialogDescription className={dialogDescriptionClassName}>
              {t(
                roleUser?.role === "admin"
                  ? "management.roleRevokeHelp"
                  : "management.roleGrantHelp",
                { name: roleUser?.name || roleUser?.email || "" },
              )}
            </AlertDialogDescription>
            {roleUser?.name && (
              <p className={helpTextClassName}>{roleUser.email}</p>
            )}
            <p className={helpTextClassName}>
              {t("management.roleSessionsHelp")}
            </p>
          </ModalBody>
          <AlertDialogFooter className={dialogFooterClassName}>
            <AlertDialogCancel
              className={confirmationCancelClassName}
              disabled={!!mutating}
            >
              {t("management.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirmationActionClassName,
                roleUser?.role === "admin"
                  ? ""
                  : "bg-[#176b51] text-white enabled:hover:bg-[#0b503b]",
              )}
              disabled={!!mutating}
              onClick={(event) => {
                event.preventDefault();
                void changeRole();
              }}
            >
              {mutating ? (
                <>
                  <LoaderCircle
                    size={16}
                    className="inline-block animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {t("management.changingRole")}
                </>
              ) : roleUser?.role === "admin" ? (
                t("management.revokeAdmin")
              ) : (
                t("management.makeAdmin")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(open) => {
          if (!open && !mutating) setDeleteUser(null);
        }}
      >
        <AlertDialogContent className={confirmationDialogClassName}>
          <AlertDialogHeader className={dialogHeaderClassName}>
            <AlertDialogTitle className={dialogTitleClassName}>
              {t("management.deleteUserTitle")}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <ModalBody>
            <AlertDialogDescription className={dialogDescriptionClassName}>
              {t("management.deleteUserHelp", {
                name: deleteUser?.name || deleteUser?.email || "",
              })}
            </AlertDialogDescription>
            {deleteUser?.name && (
              <p className={helpTextClassName}>{deleteUser.email}</p>
            )}
            {deleteError && (
              <p className={errorClassName} role="alert">
                {deleteError}
              </p>
            )}
          </ModalBody>
          <AlertDialogFooter className={dialogFooterClassName}>
            <AlertDialogCancel
              className={confirmationCancelClassName}
              disabled={!!mutating}
            >
              {t("management.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className={confirmationActionClassName}
              disabled={!!mutating}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {mutating ? (
                <>
                  <LoaderCircle
                    size={16}
                    className="inline-block animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {t("management.deleting")}
                </>
              ) : (
                t("management.deleteUser")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
