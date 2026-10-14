"use client";
import { cn } from "@/lib/utils";
import {
  pageFrameClassName,
  appButton,
  errorClassName,
  emptyStateClassName,
  formClassName,
  formLabelClassName,
  inputClassName,
  formGridClassName,
  formHintClassName,
  textareaClassName,
  helpTextClassName,
} from "@/lib/presentation";
import { WorkshopEmailsEditor } from "@/components/workshop-emails";
import {
  workshopEmailEditsSchema,
  sameWorkshopEmailEdits,
  type WorkshopEmailEdit,
} from "@/lib/workshop-emails";
import { AdminLoading } from "@/components/admin-loading";
import { useI18n } from "@/lib/i18n/client";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { valueLabel } from "@/lib/i18n/values";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { useCallback, useEffect, useState, useId, type FormEvent } from "react";
import { Wrench, Plus, Search, LoaderCircle, Pencil } from "lucide-react";
import { ModalContent } from "@/components/modal-shell";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Picker } from "@/components/picker";
import { PremiumPartnerControl } from "@/components/premium-partner-control";
import { SiteHeader } from "@/components/site-header";
import type { AccountIdentity } from "@/components/account-storage-notice";
import { AdminNavigation } from "@/components/admin-navigation";
import { cities, services, type Workshop } from "@/lib/workshops";

type Draft = {
  emailEntries: WorkshopEmailEdit[];
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  phoneNote: string;
  whatsapp: string;
  brands: string;
  services: string[];
  serviceDetails: string;
  languages: string;
  specialty: string;
  description: string;
  lat: string;
  lng: string;
  sources: string;
  checkedAt: string;
  status: "draft" | "published";
  previousUpdatedAt: string;
};
const fresh = (): Draft => ({
  emailEntries: [],
  id: crypto.randomUUID(),
  name: "",
  city: "Prishtina",
  address: "",
  phone: "+383",
  phoneNote: "Werkstattkontakt",
  whatsapp: "",
  brands: "",
  services: [],
  serviceDetails: "",
  languages: "",
  specialty: "",
  description: "",
  lat: "",
  lng: "",
  sources: "",
  checkedAt: new Date().toISOString().slice(0, 10),
  status: "draft",
  previousUpdatedAt: "",
});
function fromWorkshop(w: Workshop): Draft {
  return {
    emailEntries: w.editableEmailContacts ?? [],
    id: w.id,
    name: w.name,
    city: w.city,
    address: w.address,
    phone: w.phone,
    phoneNote: w.phoneNote,
    whatsapp: w.whatsapp,
    brands: w.brands.join(", "),
    services: w.services,
    serviceDetails: w.serviceDetails.join("\n"),
    languages: w.languages.join(", "),
    specialty: w.specialty,
    description: w.description,
    lat: w.lat === null ? "" : String(w.lat),
    lng: w.lng === null ? "" : String(w.lng),
    sources: w.sources.map((s) => s.url).join("\n"),
    checkedAt: w.checkedAt,
    status: w.status,
    previousUpdatedAt: w.updatedAt,
  };
}
export default function AdminPanel({ account }: { account: AccountIdentity }) {
  const { locale, t } = useI18n();
  const editorFormId = useId();
  const [list, setList] = useState<Workshop[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [editor, setEditor] = useState(false),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [dirty, setDirty] = useState(false);
  useNavigationGuard({ busy: saving, dirty: editor && dirty });
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/workshops?admin=1");
      const d = (await r.json()) as CodedResponse & { workshops: Workshop[] };
      if (!r.ok) throw responseError(t, d);
      setList(d.workshops);
    } catch (e) {
      setError(
        e instanceof LocalizedError ? e.message : t("management.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mounting this management screen starts the remote directory load.
    void load();
  }, [load]);
  function open(w?: Workshop) {
    setDirty(false);
    setDraft(w ? fromWorkshop(w) : fresh());
    setEditing(!!w);
    setFormError("");
    setEditor(true);
  }
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDirty(true);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setFormError("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setFormError("");
    try {
      const sources = draft.sources
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url) => ({ url, title: new URL(url).hostname }));
      const emails = workshopEmailEditsSchema.parse(
        draft.emailEntries
          .map((entry) => ({ ...entry, address: entry.address.trim() }))
          .filter((entry) => entry.address),
      );
      const current = list.find((w) => w.id === draft.id);
      const payload = {
        ...draft,
        emailEntries: (
          editing
            ? sameWorkshopEmailEdits(
                emails,
                current?.editableEmailContacts ?? [],
              )
            : emails.length === 0
        )
          ? undefined
          : emails,
        brands: draft.brands
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        serviceDetails: draft.serviceDetails
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        languages: draft.languages
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        sources,
        lat: draft.lat === "" ? null : Number(draft.lat),
        lng: draft.lng === "" ? null : Number(draft.lng),
      };
      const r = await fetch("/api/workshops", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = (await r.json()) as CodedResponse;
      if (!r.ok) throw responseError(t, d);
      setEditor(false);
      setFeedback(
        draft.status === "published"
          ? t("management.profilePublished")
          : t("management.profileDraftSaved"),
      );
      await load();
    } catch (e) {
      setFormError(
        e instanceof LocalizedError ? e.message : t("management.checkInputs"),
      );
    } finally {
      setSaving(false);
    }
  }
  const visible = list.filter((w) =>
    `${w.name} ${w.city} ${w.address}`
      .toLocaleLowerCase(locale)
      .includes(query.toLocaleLowerCase(locale)),
  );
  return (
    <>
      <SiteHeader account={account} isAdmin />
      <AdminNavigation active="workshops" />
      <main className={cn(pageFrameClassName, "pt-8 pb-[60px]")}>
        <div
          data-ui="admin-title"
          className="flex items-center justify-between gap-[30px] at-most-1000:items-start at-most-720:flex-col at-most-720:gap-[18px]"
        >
          <h1 className="text-[32px] leading-[1.2] font-semibold tracking-[-1px] at-most-720:text-[28px] m-0">
            {t("management.manageWorkshops")}
          </h1>
          <button
            className={cn(
              appButton(),
              "whitespace-nowrap at-most-1000:text-[13px]",
            )}
            disabled={saving}
            onClick={() => open()}
          >
            <Plus size={17} />
            {t("management.addWorkshop")}
          </button>
        </div>
        <div
          data-ui="admin-overview"
          className="my-6 grid grid-cols-2 gap-[17px] at-most-720:grid-cols-1 at-most-720:gap-2.5"
        >
          <div className="relative flex flex-col items-start rounded-[10px] border border-[#dce7e8] bg-[#f4f8f8] px-6 py-5 dark:border-border dark:bg-[var(--theme-surface)] dark:text-foreground at-most-720:px-5 at-most-720:py-4">
            <strong className="text-[32px] leading-[1.3] font-semibold at-most-720:text-[27px]">
              {formatNumber(
                locale,
                list.filter((w) => w.status === "published").length,
              )}
            </strong>
            <span className="text-[13px] text-[#7d8e6f] dark:text-muted-foreground at-most-720:text-[14px]">
              {t("management.publishedLocations")}
            </span>
          </div>
          <div className="relative flex flex-col items-start rounded-[10px] border border-[#dce7e8] bg-[#f4f8f8] px-6 py-5 dark:border-border dark:bg-[var(--theme-surface)] dark:text-foreground at-most-720:px-5 at-most-720:py-4">
            <strong className="text-[32px] leading-[1.3] font-semibold at-most-720:text-[27px]">
              {formatNumber(
                locale,
                list.filter((w) => w.status === "draft").length,
              )}
            </strong>
            <span className="text-[13px] text-[#7d8e6f] dark:text-muted-foreground at-most-720:text-[14px]">
              {t("management.drafts")}
            </span>
          </div>
        </div>
        <div
          data-ui="admin-tools"
          className="mb-[22px] flex items-center gap-3 at-most-1000:flex-wrap at-most-720:gap-2"
        >
          <label className="flex items-center gap-[9px] rounded-[7px] border border-[#dbe5d4] px-3 py-[9px] text-[#79946a] dark:border-border dark:text-muted-foreground at-most-1000:flex-1 at-most-720:w-full at-most-720:flex-auto mr-0 w-full min-w-0">
            <Search size={16} />
            <input
              className="min-w-0 border-0 bg-transparent text-[14px] outline-none w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t("management.workshopSearch")}
              placeholder={t("management.nameCitySearch")}
            />
          </label>
        </div>
        {feedback && (
          <p
            role="status"
            className="mb-4 rounded-lg bg-[#eef6e9] px-[15px] py-3 text-[14px] text-[#527d4d] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
          >
            {feedback}
          </p>
        )}
        {error && (
          <p role="alert" className={errorClassName}>
            {error}
          </p>
        )}
        {loading && (
          <AdminLoading>{t("management.workshopsLoading")}</AdminLoading>
        )}
        <div
          data-ui="directory-table"
          className="overflow-hidden rounded-[10px] border border-[#e5edef] bg-white dark:border-[#214045] dark:bg-card dark:text-foreground at-most-720:overflow-auto"
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-[#f8faf5] dark:hover:border-input dark:hover:bg-[var(--theme-hover)] border-[#e5edef] dark:border-[#214045]">
                <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                  {t("management.workshop")}
                </TableHead>
                <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                  {t("management.city")}
                </TableHead>
                <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                  {t("management.status")}
                </TableHead>
                <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                  {t("management.sourceCheck")}
                </TableHead>
                <TableHead className="bg-[#f6f8f3] px-[18px] py-[15px] text-[13px] text-[#7a8b6d] dark:bg-secondary dark:text-muted-foreground at-most-720:p-3">
                  <span className="sr-only">{t("management.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((w) => (
                <TableRow
                  className="hover:bg-[#f8faf5] dark:hover:border-input dark:hover:bg-[var(--theme-hover)] border-[#e5edef] dark:border-[#214045]"
                  key={w.id}
                >
                  <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px]">
                    <strong>{w.name}</strong>
                    <span className="mt-0.5 block text-[12px] text-[#85977b] dark:text-muted-foreground">
                      {w.specialty}
                    </span>
                  </TableCell>
                  <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px]">
                    {w.city}
                  </TableCell>
                  <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px]">
                    <span
                      data-ui="publication-status"
                      data-status={w.status}
                      className={cn(
                        "inline-block rounded-[5px] px-[9px] py-[3px] text-[12px] whitespace-nowrap",
                        w.status === "published"
                          ? "bg-[#eaf4e6] text-[#4a7849] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
                          : "bg-[#f2f2e6] text-[#8a8055] dark:bg-[#3b3020] dark:text-[var(--theme-warning)]",
                      )}
                    >
                      {w.status === "published"
                        ? t("management.published")
                        : t("management.draftHidden")}
                    </span>
                  </TableCell>
                  <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px]">
                    {formatDate(locale, w.checkedAt, { dateOnly: true })}
                  </TableCell>
                  <TableCell className="px-[18px] py-[17px] text-[14px] at-most-720:p-3 at-most-720:text-[13px]">
                    <div className="flex flex-col items-start gap-2.5">
                      <button
                        data-ui="text-action"
                        className={cn(
                          appButton({ variant: "text" }),
                          "m-0 inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap",
                        )}
                        disabled={saving}
                        onClick={() => open(w)}
                      >
                        <Pencil
                          className="shrink-0"
                          size={15}
                          aria-hidden="true"
                        />
                        {t("management.edit")}
                      </button>
                      <PremiumPartnerControl workshop={w} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!loading && !error && !visible.length && (
          <div className={emptyStateClassName}>
            <Wrench size={24} />
            <h3>{t("management.noWorkshops")}</h3>
            <button
              className={appButton({ variant: "outline" })}
              onClick={() => open()}
            >
              {t("management.addWorkshop")}
            </button>
          </div>
        )}
      </main>
      <Dialog
        open={editor}
        onOpenChange={(v) => {
          if (!saving) setEditor(v);
        }}
      >
        <ModalContent
          className="max-w-[min(750px,calc(100%_-_32px))] sm:max-w-[min(750px,calc(100%_-_32px))]"
          closeDisabled={saving}
          title={
            editing ? t("management.editWorkshop") : t("management.addWorkshop")
          }
          description={t("management.publishSupported")}
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
                disabled={saving || !draft}
                className={cn(
                  appButton(),
                  "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:flex-1",
                )}
                type="submit"
                form={editorFormId}
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="inline-block animate-spin motion-reduce:animate-none"
                    />
                    {t("management.saving")}
                  </>
                ) : draft?.status === "published" ? (
                  t("management.publishProfile")
                ) : (
                  t("management.saveDraft")
                )}
              </button>
            </>
          }
        >
          {draft && (
            <form id={editorFormId} className={formClassName} onSubmit={save}>
              <label className={formLabelClassName}>
                {t("management.workshopName")}
                <input
                  className={inputClassName}
                  disabled={saving}
                  required
                  minLength={3}
                  maxLength={120}
                  value={draft.name}
                  onChange={(e) => change("name", e.target.value)}
                />
              </label>
              <div className={formGridClassName}>
                <Field className="min-w-0 gap-1.5 border-0 bg-transparent p-0">
                  <FieldLabel
                    className="m-0 block text-[14px] font-semibold text-foreground"
                    htmlFor={`${editorFormId}-city`}
                  >
                    {t("management.city")}
                  </FieldLabel>
                  <Picker
                    presentation="form"
                    id={`${editorFormId}-city`}
                    disabled={saving}
                    value={draft.city}
                    onChange={(v) => change("city", v)}
                    values={cities.slice(1)}
                    label={t("management.workshopCity")}
                  />
                </Field>
                <label className={formLabelClassName}>
                  {t("management.checkedOn")}
                  <input
                    className={inputClassName}
                    disabled={saving}
                    required
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={draft.checkedAt}
                    onChange={(e) => change("checkedAt", e.target.value)}
                  />
                </label>
              </div>
              <label className={formLabelClassName}>
                {t("management.address")}
                <input
                  className={inputClassName}
                  disabled={saving}
                  required
                  minLength={5}
                  maxLength={250}
                  value={draft.address}
                  onChange={(e) => change("address", e.target.value)}
                />
              </label>
              <div className={formGridClassName}>
                <label className={formLabelClassName}>
                  {t("management.phoneNumber")}
                  <input
                    className={inputClassName}
                    disabled={saving}
                    required
                    type="tel"
                    placeholder="+38344123456"
                    value={draft.phone}
                    onChange={(e) => change("phone", e.target.value)}
                  />
                </label>
                <label className={formLabelClassName}>
                  {t("management.contactNote")}
                  <input
                    className={inputClassName}
                    disabled={saving}
                    value={draft.phoneNote}
                    maxLength={150}
                    placeholder={t("management.contactExample")}
                    onChange={(e) => change("phoneNote", e.target.value)}
                  />
                </label>
              </div>
              <label className={formLabelClassName}>
                {t("management.confirmedWhatsApp")}{" "}
                <span className={formHintClassName}>
                  {t("management.optional")}
                </span>
                <input
                  className={inputClassName}
                  disabled={saving}
                  type="tel"
                  placeholder={t("management.explicitWhatsApp")}
                  value={draft.whatsapp}
                  onChange={(e) => change("whatsapp", e.target.value)}
                />
              </label>
              <fieldset disabled={saving}>
                <WorkshopEmailsEditor
                  presentation="form"
                  emails={draft.emailEntries}
                  onChange={(emails) => change("emailEntries", emails)}
                />
              </fieldset>
              <label className={formLabelClassName}>
                {t("management.publishedBrands")}{" "}
                <span className={formHintClassName}>
                  {t("management.commaUnknown")}
                </span>
                <input
                  className={inputClassName}
                  disabled={saving}
                  value={draft.brands}
                  maxLength={600}
                  placeholder={t("management.brandExample")}
                  onChange={(e) => change("brands", e.target.value)}
                />
              </label>
              <fieldset className="grid grid-cols-2 gap-2.5 rounded-lg border border-[#dce6d4] px-[15px] pt-[13px] pb-[15px] dark:border-border dark:bg-card at-most-720:grid-cols-1">
                <legend className="px-1 text-[14px] font-semibold">
                  {t("management.serviceAreas")}
                </legend>
                {services.slice(1).map((s) => (
                  <label
                    className={cn(
                      formLabelClassName,
                      "flex items-center gap-[9px] text-[13px] font-normal",
                    )}
                    key={s}
                  >
                    <Checkbox
                      disabled={saving}
                      checked={draft.services.includes(s)}
                      onCheckedChange={(v) =>
                        change(
                          "services",
                          v
                            ? [...draft.services, s]
                            : draft.services.filter((x) => x !== s),
                        )
                      }
                    />
                    <span className={formHintClassName}>
                      {valueLabel(locale, "service", s)}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className={formLabelClassName}>
                {t("management.publishedServices")}{" "}
                <span className={formHintClassName}>
                  {t("management.onePerLine")}
                </span>
                <textarea
                  className={textareaClassName}
                  disabled={saving}
                  required
                  rows={4}
                  maxLength={3000}
                  value={draft.serviceDetails}
                  placeholder={t("management.serviceExample")}
                  onChange={(e) => change("serviceDetails", e.target.value)}
                />
              </label>
              <div className={formGridClassName}>
                <label className={formLabelClassName}>
                  {t("management.specialty")}
                  <input
                    className={inputClassName}
                    disabled={saving}
                    required
                    minLength={3}
                    maxLength={100}
                    placeholder={t("management.specialtyExample")}
                    value={draft.specialty}
                    onChange={(e) => change("specialty", e.target.value)}
                  />
                </label>
                <label className={formLabelClassName}>
                  {t("management.confirmedLanguages")}{" "}
                  <span className={formHintClassName}>
                    {t("management.optional")}
                  </span>
                  <input
                    className={inputClassName}
                    disabled={saving}
                    value={draft.languages}
                    maxLength={200}
                    placeholder={t("management.languageExample")}
                    onChange={(e) => change("languages", e.target.value)}
                  />
                </label>
              </div>
              <label className={formLabelClassName}>
                {t("management.description")}
                <textarea
                  className={textareaClassName}
                  disabled={saving}
                  required
                  minLength={20}
                  rows={4}
                  maxLength={2000}
                  value={draft.description}
                  onChange={(e) => change("description", e.target.value)}
                />
              </label>
              <label className={formLabelClassName}>
                {t("management.sourceLinks")}{" "}
                <span className={formHintClassName}>
                  {t("management.httpsPerLine")}
                </span>
                <textarea
                  className={textareaClassName}
                  disabled={saving}
                  required={draft.status === "published"}
                  rows={3}
                  value={draft.sources}
                  maxLength={4000}
                  onChange={(e) => change("sources", e.target.value)}
                  placeholder="https://werkstatt.example/kontakt"
                />
              </label>
              <details>
                <summary className="mb-3 cursor-pointer text-[14px] font-semibold text-[#567c4f] dark:text-muted-foreground">
                  {t("management.preciseLocation")}
                </summary>
                <p
                  className={cn(
                    cn(helpTextClassName, "mb-3"),
                    "leading-[1.65]",
                  )}
                >
                  {t("management.coordinatesHelp")}
                </p>
                <div className={formGridClassName}>
                  <label className={formLabelClassName}>
                    {t("management.latitude")}
                    <input
                      className={inputClassName}
                      disabled={saving}
                      type="number"
                      step="any"
                      min="41.8"
                      max="43.3"
                      value={draft.lat}
                      onChange={(e) => change("lat", e.target.value)}
                    />
                  </label>
                  <label className={formLabelClassName}>
                    {t("management.longitude")}
                    <input
                      className={inputClassName}
                      disabled={saving}
                      type="number"
                      step="any"
                      min="19.8"
                      max="21.9"
                      value={draft.lng}
                      onChange={(e) => change("lng", e.target.value)}
                    />
                  </label>
                </div>
              </details>
              <Field className="min-w-0 gap-1.5 border-0 bg-transparent p-0">
                <FieldLabel
                  className="m-0 block text-[14px] font-semibold text-foreground"
                  htmlFor={`${editorFormId}-status`}
                >
                  {t("management.visibility")}
                </FieldLabel>
                <Picker
                  presentation="form"
                  id={`${editorFormId}-status`}
                  disabled={saving}
                  value={draft.status}
                  onChange={(v) => change("status", v as "draft" | "published")}
                  values={["draft", "published"]}
                  displayLabels={{
                    draft: t("management.draftHidden"),
                    published: t("management.publishSearch"),
                  }}
                  label={t("management.profileVisibility")}
                />
              </Field>
              <p className={cn(helpTextClassName, "leading-[1.65]")}>
                {t("management.publicationHelp")}
              </p>
              {formError && (
                <p
                  role="alert"
                  className={cn(errorClassName, "leading-[1.65]")}
                >
                  {formError}
                </p>
              )}
            </form>
          )}
        </ModalContent>
      </Dialog>
    </>
  );
}
