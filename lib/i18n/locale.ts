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
// German paths identify the existing page tree; only browser-facing paths vary.
const pageRoutes:readonly Record<Locale,string>[]=[
 {de:"/",sq:"/",en:"/"},
 {de:"/werkstaetten",sq:"/serviset",en:"/workshops"},
 {de:"/anmelden",sq:"/hyr",en:"/login"},
 {de:"/registrieren",sq:"/regjistrohu",en:"/register"},
 {de:"/passwort-vergessen",sq:"/fjalekalimi-i-harruar",en:"/forgot-password"},
 {de:"/passwort-neu",sq:"/fjalekalim-i-ri",en:"/reset-password"},
 {de:"/einstellungen",sq:"/cilesimet",en:"/settings"},
 {de:"/bewertungen",sq:"/vleresimet",en:"/reviews"},
 {de:"/datenschutz",sq:"/privatesia",en:"/privacy"},
 {de:"/betriebe",sq:"/biznesi",en:"/business"},
 {de:"/antraege",sq:"/kerkesat",en:"/requests"},
 {de:"/betriebe/beanspruchen",sq:"/biznesi/kerko-pronesine",en:"/business/claim"},
 {de:"/verwaltung",sq:"/administrimi",en:"/admin"},
 {de:"/verwaltung/anmeldung",sq:"/administrimi/autentikimi",en:"/admin/authentication"},
 {de:"/verwaltung/benutzer",sq:"/administrimi/perdoruesit",en:"/admin/users"},
 {de:"/verwaltung/betriebe",sq:"/administrimi/bizneset",en:"/admin/businesses"},
 {de:"/verwaltung/bewertungen",sq:"/administrimi/vleresimet",en:"/admin/reviews"},
];
const legacyPageRoutes:Record<string,string>={"/betrieb":"/betriebe","/betrieb/beanspruchen":"/betriebe/beanspruchen"};
const profileRoute:Record<Locale,string>={de:"/werkstatt/",sq:"/servis/",en:"/workshop/"};
export function pageIdentityPath(path:string):string{
 const locale=localeFromPath(path),value=stripLocalePrefix(path).replace(/\/$/,"")||"/";
 if(legacyPageRoutes[value])return legacyPageRoutes[value];
 const route=pageRoutes.find(route=>route[locale]===value);
 if(route)return route.de;
 if(value.startsWith(profileRoute[locale]))return profileRoute.de+value.slice(profileRoute[locale].length);
 return value;
}
// Current physical public files, independently checked against public/ in tests.
// Exact paths prevent unknown dotted page routes bypassing Vinext's 404 guard.
export const publicAssetPaths:readonly string[]=["/diagnostics.jpg","/diagnostics-640.webp","/diagnostics-1024.webp","/diagnostics-1536.webp","/favicon.svg","/googled8cf505b6c63892b.html","/logo.png","/partner-bodywork-bg.webp","/partner-diagnostics-bg.webp","/partner-maintenance-bg-v2.webp","/review-experience-640.webp","/review-experience-1024.webp","/review-experience-1280.webp","/riparim-icon-display.png","/riparim-icon.png","/riparim-logo-display.png","/riparim-logo.png","/workshop.jpg","/workshop-640.webp","/workshop-1024.webp","/workshop-1536.webp"];
const technicalMetadataPaths=new Set(["/robots.txt","/sitemap.xml","/favicon.ico"]);
export function isStaticOrMetadataPath(path:string):boolean{return publicAssetPaths.includes(path)||technicalMetadataPaths.has(path);}
export function isTechnicalPath(path: string): boolean {
 return /^\/(?:api(?:\/|$)|auth\/bestaetigen(?:\/|$)|_next(?:\/|$)|signin-with-chatgpt(?:\/|$)|signout-with-chatgpt(?:\/|$)|callback(?:\/|$)|__sites_connector_preview(?:\/|$)|__migration(?:\/|$)|\.well-known(?:\/|$))/.test(path) || isStaticOrMetadataPath(path);
}
export function localizeHref(href: string, locale: Locale): string {
 if (!href.startsWith("/") || href.startsWith("//")) return href;
 const url = new URL(href, "https://riparim.invalid");
 if (url.origin !== "https://riparim.invalid" || isTechnicalPath(url.pathname)) return href;
 const identity=pageIdentityPath(url.pathname),route=pageRoutes.find(route=>route.de===identity);
 const path=route?route[locale]:identity.startsWith(profileRoute.de)?profileRoute[locale]+identity.slice(profileRoute.de.length):identity;
 return `${locale === "de" ? "" : `/${locale}`}${path === "/" && locale !== "de" ? "" : path}${url.search}${url.hash}`;
}

export function isPagePath(path:string):boolean{const value=pageIdentityPath(path);return pageRoutes.some(route=>route.de===value)||/^\/werkstatt\/[^/]+$/.test(value);}
