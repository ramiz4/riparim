export const locales = ["de", "sq", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";
export function isLocale(value: unknown): value is Locale {
 return typeof value === "string" && (locales as readonly string[]).includes(value);
}
export function localeFromPath(path: string): Locale {
 const segment = path.split(/[/?#]/)[1];
 return isLocale(segment) ? segment : defaultLocale;
}
export function stripLocalePrefix(path: string): string {
 const stripped=path.replace(/^\/(?:de|sq|en)(?=\/|\?|#|$)/, "");
 return /^[?#]/.test(stripped)?`/${stripped}`:stripped||"/";
}
// Current physical public files, independently checked against public/ in tests.
// Exact paths prevent unknown dotted page routes bypassing Vinext's 404 guard.
export const publicAssetPaths:readonly string[]=["/diagnostics.jpg","/favicon.svg","/googled8cf505b6c63892b.html","/logo.png","/riparim-icon-display.png","/riparim-icon.png","/riparim-logo-display.png","/riparim-logo.png","/workshop.jpg"];
const technicalMetadataPaths=new Set(["/robots.txt","/sitemap.xml","/favicon.ico"]);
export function isStaticOrMetadataPath(path:string):boolean{return publicAssetPaths.includes(path)||technicalMetadataPaths.has(path);}
export function isTechnicalPath(path: string): boolean {
 return /^\/(?:api(?:\/|$)|auth\/bestaetigen(?:\/|$)|_next(?:\/|$)|signin-with-chatgpt(?:\/|$)|signout-with-chatgpt(?:\/|$)|callback(?:\/|$)|__sites_connector_preview(?:\/|$)|__migration(?:\/|$)|\.well-known(?:\/|$))/.test(path) || isStaticOrMetadataPath(path);
}
export function localizeHref(href: string, locale: Locale): string {
 if (!href.startsWith("/") || href.startsWith("//")) return href;
 const url = new URL(href, "https://riparim.invalid");
 if (url.origin !== "https://riparim.invalid" || isTechnicalPath(url.pathname)) return href;
 const path = stripLocalePrefix(url.pathname);
 return `${locale === "de" ? "" : `/${locale}`}${path === "/" && locale !== "de" ? "" : path}${url.search}${url.hash}`;
}

const pagePaths=new Set(["/","/werkstaetten","/anmelden","/registrieren","/passwort-vergessen","/passwort-neu","/einstellungen","/datenschutz","/betrieb","/verwaltung","/verwaltung/anmeldung","/verwaltung/benutzer","/verwaltung/betriebe","/verwaltung/bewertungen"]);
export function isPagePath(path:string):boolean{const value=stripLocalePrefix(path).replace(/\/$/,"")||"/";return pagePaths.has(value)||/^\/werkstatt\/[^/]+$/.test(value);}
