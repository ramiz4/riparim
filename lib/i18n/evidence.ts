import type {Locale} from "./locale";

export function evidenceHref(id:string,locale:Locale){return `/api/evidence/${encodeURIComponent(id)}?locale=${locale}`;}
