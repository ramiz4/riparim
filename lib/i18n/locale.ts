export { guidePagePaths } from "../guide-routes";
import { guideRoutes } from "../guide-routes";
export const locales = ["de", "sq", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  );
}
export function localeFromPath(path: string): Locale {
  const segment = path.split(/[/?#]/)[1];
  return isLocale(segment) ? segment : defaultLocale;
}
export function stripLocalePrefix(path: string): string {
  const stripped = path.replace(/^\/(?:de|sq|en)(?=\/|\?|#|$)/, "");
  return /^[?#]/.test(stripped) ? `/${stripped}` : stripped || "/";
}
// Source identities are English; localized public URLs remain stable.
const pageRoutes: readonly (Record<Locale, string> & { id: string })[] = [
  { id: "/", de: "/", sq: "/", en: "/" },
  ...guideRoutes,
  { id: "/workshops", de: "/werkstaetten", sq: "/serviset", en: "/workshops" },
  { id: "/login", de: "/anmelden", sq: "/hyr", en: "/login" },
  { id: "/register", de: "/registrieren", sq: "/regjistrohu", en: "/register" },
  {
    id: "/forgot-password",
    de: "/passwort-vergessen",
    sq: "/fjalekalimi-i-harruar",
    en: "/forgot-password",
  },
  {
    id: "/reset-password",
    de: "/passwort-neu",
    sq: "/fjalekalim-i-ri",
    en: "/reset-password",
  },
  { id: "/settings", de: "/einstellungen", sq: "/cilesimet", en: "/settings" },
  { id: "/reviews", de: "/bewertungen", sq: "/vleresimet", en: "/reviews" },
  { id: "/privacy", de: "/datenschutz", sq: "/privatesia", en: "/privacy" },
  { id: "/business", de: "/betriebe", sq: "/biznesi", en: "/business" },
  { id: "/requests", de: "/antraege", sq: "/kerkesat", en: "/requests" },
  {
    id: "/business/claim",
    de: "/betriebe/beanspruchen",
    sq: "/biznesi/kerko-pronesine",
    en: "/business/claim",
  },
  { id: "/admin", de: "/verwaltung", sq: "/administrimi", en: "/admin" },
  {
    id: "/admin/authentication",
    de: "/verwaltung/anmeldung",
    sq: "/administrimi/autentikimi",
    en: "/admin/authentication",
  },
  {
    id: "/admin/users",
    de: "/verwaltung/benutzer",
    sq: "/administrimi/perdoruesit",
    en: "/admin/users",
  },
  {
    id: "/admin/businesses",
    de: "/verwaltung/betriebe",
    sq: "/administrimi/bizneset",
    en: "/admin/businesses",
  },
  {
    id: "/admin/reviews",
    de: "/verwaltung/bewertungen",
    sq: "/administrimi/vleresimet",
    en: "/admin/reviews",
  },
];
const legacyPageRoutes: Record<string, string> = {
  "/betrieb": "/business",
  "/betrieb/beanspruchen": "/business/claim",
};
const profileRoute: Record<Locale, string> = {
  de: "/werkstatt/",
  sq: "/servis/",
  en: "/workshop/",
};
const profileIdentity = "/workshop/";
export function pageIdentityPath(path: string): string {
  const locale = localeFromPath(path),
    value = stripLocalePrefix(path).replace(/\/$/, "") || "/";
  if (legacyPageRoutes[value]) return legacyPageRoutes[value];
  const route = pageRoutes.find(
    (route) =>
      route[locale] === value || route.de === value || route.id === value,
  );
  if (route) return route.id;
  for (const prefix of [profileRoute[locale], profileRoute.de, profileIdentity])
    if (value.startsWith(prefix))
      return profileIdentity + value.slice(prefix.length);
  return value;
}
// Current physical public files, independently checked against public/ in tests.
// Exact paths prevent unknown dotted page routes bypassing Vinext's 404 guard.
export const publicAssetPaths: readonly string[] = [
  "/diagnostics.jpg",
  "/diagnostics-640.webp",
  "/diagnostics-1024.webp",
  "/diagnostics-1536.webp",
  "/favicon.svg",
  "/googled8cf505b6c63892b.html",
  "/logo.png",
  "/partner-bodywork-bg.webp",
  "/partner-diagnostics-bg.webp",
  "/partner-maintenance-bg-v2.webp",
  "/review-experience-640.webp",
  "/review-experience-1024.webp",
  "/review-experience-1280.webp",
  "/riparim-icon-display.png",
  "/riparim-icon.png",
  "/riparim-logo-display.png",
  "/riparim-logo.png",
  "/workshop.jpg",
  "/workshop-640.webp",
  "/workshop-1024.webp",
  "/workshop-1536.webp",
];
const technicalMetadataPaths = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
]);
export function isStaticOrMetadataPath(path: string): boolean {
  return publicAssetPaths.includes(path) || technicalMetadataPaths.has(path);
}
export function isTechnicalPath(path: string): boolean {
  return (
    /^\/(?:api(?:\/|$)|auth\/(?:bestaetigen|confirm)(?:\/|$)|_next(?:\/|$)|signin-with-chatgpt(?:\/|$)|signout-with-chatgpt(?:\/|$)|callback(?:\/|$)|__sites_connector_preview(?:\/|$)|__migration(?:\/|$)|\.well-known(?:\/|$))/.test(
      path,
    ) || isStaticOrMetadataPath(path)
  );
}
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://riparim.invalid");
  if (url.origin !== "https://riparim.invalid" || isTechnicalPath(url.pathname))
    return href;
  const identity = pageIdentityPath(url.pathname),
    route = pageRoutes.find((route) => route.id === identity);
  const path = route
    ? route[locale]
    : identity.startsWith(profileIdentity)
      ? profileRoute[locale] + identity.slice(profileIdentity.length)
      : identity;
  return `${locale === "de" ? "" : `/${locale}`}${path === "/" && locale !== "de" ? "" : path}${url.search}${url.hash}`;
}

export function isPagePath(path: string): boolean {
  const locale = localeFromPath(path),
    value = stripLocalePrefix(path).replace(/\/$/, "") || "/",
    hasLocalePrefix = /^\/(?:de|sq|en)(?:\/|$)/.test(path);
  return (
    !!legacyPageRoutes[value] ||
    pageRoutes.some(
      (route) =>
        route[locale] === value ||
        route.de === value ||
        (!hasLocalePrefix && route.id === value),
    ) ||
    [
      profileRoute[locale],
      profileRoute.de,
      ...(!hasLocalePrefix ? [profileIdentity] : []),
    ].some(
      (prefix) =>
        value.startsWith(prefix) && /^[^/]+$/.test(value.slice(prefix.length)),
    )
  );
}
