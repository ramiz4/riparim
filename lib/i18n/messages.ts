import { cityDe, citySq, cityEn } from "./city-messages";
import { weekdayDe, weekdaySq, weekdayEn } from "./weekday-messages";
import { defaultLocale, isLocale, type Locale } from "./locale";
import { formatNumber } from "./format";
import { publicDe, publicSq, publicEn } from "./public-messages";
import { customerDe, customerSq, customerEn } from "./customer-messages";
import {
  managementDe,
  managementSq,
  managementEn,
} from "./management-messages";
import type {
  MessageValue,
  ParameterNames,
  MessageShape,
  CheckedMessages,
} from "./message-contract";

const deBase = {
  common: /* @__PURE__ */ Object.assign({}, weekdayDe, {
    moreSelections: "+{count} weitere",
    removeOption: "{value} entfernen",
    searchOptions: "{label} durchsuchen …",
    noOptions: "Keine passende Option gefunden.",
    selectedOptions: "{count} ausgewählt",

    workshopEmailActive: "Aktiv",
    workshopEmailInactive: "Deaktiviert",
    workshopEmailVerified: "Verifiziert",
    workshopEmailUnverified: "Nicht verifiziert",
    workshopEmailVerify: "Adresse verifizieren",
    workshopEmailEnable: "Adresse öffentlich anzeigen",
    workshopEmails: "E-Mail-Adressen",
    workshopEmailsHelp:
      "Bis zu zehn unterschiedliche Kontaktadressen. Entferne alle Adressen, um die E-Mail-Anzeige auszublenden.",
    workshopEmailNumber: "E-Mail-Adresse {number}",
    workshopEmailRemove: "E-Mail-Adresse {number} entfernen",
    workshopEmailAdd: "E-Mail-Adresse hinzufügen",
    workshopEmailsUnchanged: "E-Mail-Adressen bleiben unverändert.",
    hoursToday: "Heute",
    hoursWeek: "Wochenplan und Ausnahmen",
    hoursUnchanged: "Öffnungszeiten bleiben unverändert.",
    hoursTitle: "Öffnungszeiten",
    hoursUnknown: "Nicht angegeben",
    hoursClosed: "Geschlossen",
    hoursAppointment: "Nach Vereinbarung",
    hoursOpen: "Geöffnet",
    hoursNowOpen: "Jetzt geöffnet",
    hoursNowClosed: "Jetzt geschlossen",
    hoursMissing:
      "Öffnungszeiten noch nicht angegeben. Bitte direkt bei der Werkstatt nachfragen.",
    hoursSource: "Öffnungszeiten laut Werkstatt",
    hoursConfirmed: "Zuletzt bestätigt am {date}",
    hoursExceptions: "Feiertage und Ausnahmen",
    hoursDayStatus: "Tagesstatus",
    hoursFrom: "Von",
    hoursUntil: "Bis",
    hoursRemove: "Entfernen",
    hoursRemoveInterval: "Zeitfenster {number} für {day} entfernen",
    hoursAddInterval: "Weiteres Zeitfenster",
    hoursProvide: "Eigene Öffnungszeiten angeben",
    hoursEditingHelp:
      "Gib die Zeiten deiner Werkstatt an. Änderungen werden nach Freigabe veröffentlicht. Bis zu drei Zeitfenster je Tag, in zeitlicher Reihenfolge. Verwende HH:MM; 24:00 bedeutet Mitternacht. Für Öffnung über Mitternacht trage auf beiden Tagen ein Zeitfenster ein.",
    hoursCopyWeekdays: "Montag auf Montag–Freitag übernehmen",
    hoursDate: "Datum",
    hoursExceptionDay: "Abweichender Tagesplan",
    hoursAddException: "Ausnahme hinzufügen",

    retry: "Erneut laden",
    darkMode: "Dark Mode",
    themeSystem: "Dark Mode · folgt dem System",
    themeToggle: "Dark Mode umschalten",
    close: "Schließen",
    dialogContent: "Dialoginhalt",
    workshops: "Werkstätten",
    loadingWorkshops: "Werkstätten werden geladen …",
    loadingProfile: "Werkstattprofil wird geladen …",
    profileNotAvailable: "Dieses Profil ist nicht verfügbar.",
    profileNotAvailableHelp:
      "Die Werkstatt ist nicht veröffentlicht oder der Link ist nicht mehr aktuell.",
    findWorkshops: "Werkstätten finden",
    languageLabel: "Sprache wählen",
    discardDraft:
      "Deine nicht gespeicherten Eingaben gehen beim Sprachwechsel verloren. Sprache trotzdem wechseln?",
    preferenceNotSaved:
      "Deine Sprachpräferenz konnte nicht gespeichert werden. Die ausgewählte Sprache gilt für diese Seite.",
    checkingSession: "Anmeldestatus wird geprüft …",
    homeLabel: "Riparim Startseite",
    login: "Anmelden",
    register: "Registrieren",
    userMenu: "Benutzermenü öffnen",
    myAccount: "Mein Konto",
    signedIn: "Angemeldet",
    admin: "Admin",
    myReviews: "Meine Bewertungen",
    review: "Bewerten",
    settings: "Einstellungen",
    myBusiness: "Meine Betriebe",
    myApplications: "Meine Betriebsanträge",
    manage: "Verwaltung",
    logout: "Abmelden",
    loggingOut: "Wird abgemeldet …",
    logoutFailed: "Abmelden fehlgeschlagen. Bitte versuche es erneut.",
    unavailable: "Diese Information ist momentan nicht verfügbar.",
    errorGeneric: "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut.",
    messageGeneric: "Die Aktion wurde abgeschlossen.",
    authenticationRequired: "Bitte melde dich an.",
    forbidden: "Du hast keine Berechtigung für diese Aktion.",
    invalidRequest: "Bitte prüfe deine Eingaben.",
    notFound: "Der Eintrag wurde nicht gefunden.",
    conflict:
      "Der Eintrag wurde zwischenzeitlich geändert. Bitte lade ihn erneut.",
    saved: "Änderungen gespeichert.",
    reviewCount: { one: "{count} Bewertung", other: "{count} Bewertungen" },
  } as const),
  metadata: {
    title: "Riparim – Werkstätten in Kosovo",
    description:
      "Finde Werkstätten in Kosovo, vergleiche Leistungen und kontaktiere den passenden Betrieb.",
  },
} as const;

const de = /* @__PURE__ */ Object.assign({}, deBase, {
  public: publicDe,
  city: cityDe,
  customer: customerDe,
  management: managementDe,
});

type CatalogNamespaces = {
  -readonly [N in keyof typeof de]: MessageShape<(typeof de)[N]>;
};
type CheckedCatalog<C extends CatalogNamespaces> = {
  [N in keyof CatalogNamespaces]: CheckedMessages<(typeof de)[N], C[N]>;
};
function defineCatalog<const C extends CatalogNamespaces>(
  catalog: C & CheckedCatalog<C>,
): C {
  return catalog;
}

const sq = /* @__PURE__ */ defineCatalog({
  public: publicSq,
  city: citySq,
  customer: customerSq,
  management: managementSq,
  common: /* @__PURE__ */ Object.assign({}, weekdaySq, {
    moreSelections: "+{count} të tjera",
    removeOption: "Hiq {value}",
    searchOptions: "Kërko në {label} …",
    noOptions: "Nuk u gjet asnjë opsion i përshtatshëm.",
    selectedOptions: "{count} të zgjedhura",

    workshopEmailActive: "Aktive",
    workshopEmailInactive: "Çaktivizuar",
    workshopEmailVerified: "E verifikuar",
    workshopEmailUnverified: "E paverifikuar",
    workshopEmailVerify: "Verifiko adresën",
    workshopEmailEnable: "Shfaq adresën publikisht",
    workshopEmails: "Adresat e emailit",
    workshopEmailsHelp:
      "Deri në dhjetë adresa të ndryshme kontakti. Hiqi të gjitha adresat për të fshehur emailin publik.",
    workshopEmailNumber: "Adresa e emailit {number}",
    workshopEmailRemove: "Hiq adresën e emailit {number}",
    workshopEmailAdd: "Shto adresë emaili",
    workshopEmailsUnchanged: "Adresat e emailit mbeten të pandryshuara.",
    hoursToday: "Sot",
    hoursWeek: "Orari javor dhe përjashtimet",
    hoursUnchanged: "Orari mbetet i pandryshuar.",
    hoursTitle: "Orari i punës",
    hoursUnknown: "Nuk është përcaktuar",
    hoursClosed: "Mbyllur",
    hoursAppointment: "Me marrëveshje",
    hoursOpen: "Hapur",
    hoursNowOpen: "Hapur tani",
    hoursNowClosed: "Mbyllur tani",
    hoursMissing: "Orari nuk është përcaktuar ende. Pyet direkt servisin.",
    hoursSource: "Orari sipas servisit",
    hoursConfirmed: "Konfirmuar për herë të fundit më {date}",
    hoursExceptions: "Festat dhe përjashtimet",
    hoursDayStatus: "Statusi i ditës",
    hoursFrom: "Nga",
    hoursUntil: "Deri",
    hoursRemove: "Hiq",
    hoursRemoveInterval: "Hiq intervalin {number} për {day}",
    hoursAddInterval: "Shto interval",
    hoursProvide: "Përcakto orarin e punës",
    hoursEditingHelp:
      "Jep orarin e servisit tënd. Ndryshimet publikohen pas miratimit. Deri në tre intervale në ditë, sipas rendit kohor. Përdor HH:MM; 24:00 është mesnatë. Për hapje pas mesnatës jep intervale në të dyja ditët.",
    hoursCopyWeekdays: "Kopjo të hënën në ditët e punës",
    hoursDate: "Data",
    hoursExceptionDay: "Orari i ndryshuar i ditës",
    hoursAddException: "Shto përjashtim",

    retry: "Ngarko përsëri",
    darkMode: "Mënyra e errët",
    themeSystem: "Mënyra e errët · ndjek sistemin",
    themeToggle: "Ndërro mënyrën e errët",
    close: "Mbyll",
    dialogContent: "Përmbajtja e dialogut",
    workshops: "Servise",
    loadingWorkshops: "Duke ngarkuar serviset …",
    loadingProfile: "Duke ngarkuar profilin e servisit …",
    profileNotAvailable: "Ky profil nuk është i disponueshëm.",
    profileNotAvailableHelp:
      "Servisi nuk është i publikuar ose lidhja nuk është më aktuale.",
    findWorkshops: "Gjej servise",
    languageLabel: "Zgjidh gjuhën",
    discardDraft:
      "Të dhënat që nuk i ke ruajtur do të humbasin kur të ndërrosh gjuhën. Dëshiron të vazhdosh?",
    preferenceNotSaved:
      "Preferenca jote e gjuhës nuk mund të ruhej. Gjuha e zgjedhur vlen për këtë faqe.",
    checkingSession: "Po kontrollohet hyrja …",
    homeLabel: "Faqja kryesore e Riparim",
    login: "Hyr",
    register: "Regjistrohu",
    userMenu: "Hap menynë e përdoruesit",
    myAccount: "Llogaria ime",
    signedIn: "I identifikuar",
    admin: "Administrator",
    myReviews: "Vlerësimet e mia",
    review: "Vlerëso",
    settings: "Cilësimet",
    myBusiness: "Bizneset e mia",
    myApplications: "Kërkesat e mia për bizneset",
    manage: "Administrimi",
    logout: "Dil",
    loggingOut: "Duke dalë …",
    logoutFailed: "Dalja dështoi. Provo përsëri.",
    unavailable: "Ky informacion nuk është i disponueshëm për momentin.",
    errorGeneric: "Veprimi dështoi. Provo përsëri.",
    messageGeneric: "Veprimi përfundoi.",
    authenticationRequired: "Identifikohu për të vazhduar.",
    forbidden: "Nuk ke leje për këtë veprim.",
    invalidRequest: "Kontrollo të dhënat që ke dhënë.",
    notFound: "Ky regjistrim nuk u gjet.",
    conflict: "Ky regjistrim ka ndryshuar ndërkohë. Ngarkoje përsëri.",
    saved: "Ndryshimet u ruajtën.",
    reviewCount: { one: "{count} vlerësim", other: "{count} vlerësime" },
  } as const),
  metadata: {
    title: "Riparim – Servise në Kosovë",
    description:
      "Gjej servise në Kosovë, krahaso shërbimet dhe kontakto biznesin e duhur.",
  },
} as const satisfies CatalogNamespaces);

const en = /* @__PURE__ */ defineCatalog({
  public: publicEn,
  city: cityEn,
  customer: customerEn,
  management: managementEn,
  common: /* @__PURE__ */ Object.assign({}, weekdayEn, {
    moreSelections: "+{count} more",
    removeOption: "Remove {value}",
    searchOptions: "Search {label} …",
    noOptions: "No matching options found.",
    selectedOptions: "{count} selected",

    workshopEmailActive: "Active",
    workshopEmailInactive: "Disabled",
    workshopEmailVerified: "Verified",
    workshopEmailUnverified: "Unverified",
    workshopEmailVerify: "Verify address",
    workshopEmailEnable: "Show address publicly",
    workshopEmails: "Email addresses",
    workshopEmailsHelp:
      "Up to ten different contact addresses. Remove all addresses to hide public email contacts.",
    workshopEmailNumber: "Email address {number}",
    workshopEmailRemove: "Remove email address {number}",
    workshopEmailAdd: "Add email address",
    workshopEmailsUnchanged: "Email addresses remain unchanged.",
    hoursToday: "Today",
    hoursWeek: "Weekly schedule and exceptions",
    hoursUnchanged: "Opening hours remain unchanged.",
    hoursTitle: "Opening hours",
    hoursUnknown: "Not specified",
    hoursClosed: "Closed",
    hoursAppointment: "By appointment",
    hoursOpen: "Open",
    hoursNowOpen: "Open now",
    hoursNowClosed: "Closed now",
    hoursMissing:
      "Opening hours have not been provided yet. Please contact the workshop.",
    hoursSource: "Opening hours provided by the workshop",
    hoursConfirmed: "Last confirmed on {date}",
    hoursExceptions: "Holidays and exceptions",
    hoursDayStatus: "Day status",
    hoursFrom: "From",
    hoursUntil: "Until",
    hoursRemove: "Remove",
    hoursRemoveInterval: "Remove interval {number} for {day}",
    hoursAddInterval: "Add interval",
    hoursProvide: "Provide opening hours",
    hoursEditingHelp:
      "Enter your workshop’s hours. Changes are published after approval. Up to three intervals per day, in time order. Use HH:MM; 24:00 means midnight. For overnight opening, enter intervals on both days.",
    hoursCopyWeekdays: "Copy Monday to Monday–Friday",
    hoursDate: "Date",
    hoursExceptionDay: "Exceptional day schedule",
    hoursAddException: "Add exception",

    retry: "Reload",
    darkMode: "Dark mode",
    themeSystem: "Dark mode · follows system",
    themeToggle: "Toggle dark mode",
    close: "Close",
    dialogContent: "Dialog content",
    workshops: "Workshops",
    loadingWorkshops: "Loading workshops …",
    loadingProfile: "Loading workshop profile …",
    profileNotAvailable: "This profile is unavailable.",
    profileNotAvailableHelp:
      "The workshop is unpublished or the link is no longer current.",
    findWorkshops: "Find workshops",
    languageLabel: "Choose language",
    discardDraft:
      "Your unsaved entries will be lost when you change language. Change language anyway?",
    preferenceNotSaved:
      "Your language preference could not be saved. The selected language applies to this page.",
    checkingSession: "Checking sign-in status …",
    homeLabel: "Riparim home",
    login: "Log in",
    register: "Register",
    userMenu: "Open user menu",
    myAccount: "My account",
    signedIn: "Signed in",
    admin: "Admin",
    myReviews: "My reviews",
    review: "Write a review",
    settings: "Settings",
    myBusiness: "My businesses",
    myApplications: "My business requests",
    manage: "Administration",
    logout: "Log out",
    loggingOut: "Logging out …",
    logoutFailed: "Log out failed. Please try again.",
    unavailable: "This information is currently unavailable.",
    errorGeneric: "The action failed. Please try again.",
    messageGeneric: "The action completed.",
    authenticationRequired: "Please log in.",
    forbidden: "You do not have permission for this action.",
    invalidRequest: "Please check your entries.",
    notFound: "The entry was not found.",
    conflict: "The entry has changed. Please reload it.",
    saved: "Changes saved.",
    reviewCount: { one: "{count} review", other: "{count} reviews" },
  } as const),
  metadata: {
    title: "Riparim – Workshops in Kosovo",
    description:
      "Find workshops in Kosovo, compare services and contact the right business.",
  },
} as const satisfies CatalogNamespaces);

export type MessageNamespace = keyof CatalogNamespaces;
export type MessageCatalog = { locale: Locale } & Partial<CatalogNamespaces>;
export const defaultMessages = { locale: defaultLocale, common: deBase.common };
export type MessageKey = {
  [N in MessageNamespace]: `${N}.${Extract<keyof (typeof de)[N], string>}`;
}[MessageNamespace];
type SourceMessage<K extends MessageKey> =
  K extends `${infer N extends MessageNamespace}.${infer Name}`
    ? Name extends keyof (typeof de)[N]
      ? (typeof de)[N][Name]
      : never
    : never;
type MessageParameters<K extends MessageKey> =
  SourceMessage<K> extends string ? ParameterNames<SourceMessage<K>> : "count";
type TranslationArguments<K extends MessageKey> = [
  MessageParameters<K>,
] extends [never]
  ? []
  : [
      parameters: {
        [P in MessageParameters<K>]: P extends "count"
          ? number
          : string | number;
      },
    ];
export type Translator = <K extends MessageKey>(
  key: K,
  ...args: TranslationArguments<K>
) => string;

export function createTranslator(messages: MessageCatalog): Translator {
  const locale = isLocale(messages.locale) ? messages.locale : defaultLocale;
  const fallback =
    typeof messages.common?.unavailable === "string" &&
    messages.common.unavailable.trim()
      ? messages.common.unavailable
      : defaultMessages.common.unavailable;
  return ((key: string, parameters?: Record<string, string | number>) => {
    const [namespace, name, ...extra] = key.split(".");
    if (extra.length || !Object.hasOwn(messages, namespace)) return fallback;
    const group = messages[namespace as MessageNamespace];
    if (!group || !Object.hasOwn(group, name)) return fallback;
    const message = group[name as keyof typeof group] as
      MessageValue | undefined;
    let text: string;
    if (typeof message === "string") text = message;
    else {
      const count = parameters?.count;
      if (
        !message ||
        typeof count !== "number" ||
        !Number.isFinite(count) ||
        count < 0
      )
        return fallback;
      const category = new Intl.PluralRules(locale).select(count);
      text = category === "one" ? message.one : message.other;
    }
    if (typeof text !== "string" || !text.trim()) return fallback;
    let complete = true;
    const translated = text.replace(
      /\{([a-zA-Z]\w*)\}/g,
      (_match, name: string) => {
        const value = parameters?.[name];
        if (
          typeof value !== "string" &&
          (typeof value !== "number" || !Number.isFinite(value))
        ) {
          complete = false;
          return "";
        }
        return typeof value === "number" ? formatNumber(locale, value) : value;
      },
    );
    return complete ? translated : fallback;
  }) as Translator;
}

export function getMessages(
  locale: Locale,
): { locale: Locale } & CatalogNamespaces;
export function getMessages<const N extends readonly MessageNamespace[]>(
  locale: Locale,
  namespaces: N,
): { locale: Locale } & Pick<CatalogNamespaces, N[number]>;
export function getMessages(
  locale: Locale,
  namespaces: readonly MessageNamespace[] = [
    "common",
    "metadata",
    "public",
    "city",
    "customer",
    "management",
  ],
): MessageCatalog {
  const active = isLocale(locale) ? locale : defaultLocale;
  const catalog = { de, sq, en }[active];
  const result: MessageCatalog = { locale: active };
  for (const namespace of namespaces) {
    if (namespace === "city") result.city = catalog.city;
    if (namespace === "public") result.public = catalog.public;
    if (namespace === "customer") result.customer = catalog.customer;
    if (namespace === "management") result.management = catalog.management;
    if (namespace === "common") result.common = catalog.common;
    if (namespace === "metadata") result.metadata = catalog.metadata;
  }
  return result;
}
