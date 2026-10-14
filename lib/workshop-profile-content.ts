import {
  directoryDetailSuffix,
  scopeDetailSuffix,
  germanServicePatterns,
} from "./i18n/german-source-patterns";
import { storedSentinels, storedServices } from "@/lib/i18n/canonical-values";
import type { Locale } from "./i18n/locale";
import type { Workshop } from "./workshops";
import type { CatalogueFilters } from "./catalogue-filters";

// Display overlays are independent of factual/stored values and selection rules.
export type WorkshopDisplayContent = {
  specialty: string;
  description: string;
  serviceDetails: string[];
  phoneNote: string;
  sourceTitles: string[];
  fallback?: "missing" | "stale";
  originalLanguage?: "de";
};
export function workshopDisplayLanguage(
  display: WorkshopDisplayContent | undefined,
  locale: Locale,
) {
  return (
    display?.originalLanguage ??
    (!display || display.fallback || locale === "de" ? "" : undefined)
  );
}
export type WorkshopDisplayById = Record<string, WorkshopDisplayContent>;
export type WorkshopServiceDetail = { text: string; sourceIndex: number };
export const normalizeServiceDetail = (text: string) =>
  text.replace(directoryDetailSuffix, "").replace(scopeDetailSuffix, "").trim();
export function displayServiceDetail(
  item: WorkshopServiceDetail,
  display: WorkshopDisplayContent | undefined,
  locale: Locale,
): string {
  return locale !== "de" && display && !display.fallback
    ? (display.serviceDetails[item.sourceIndex] ?? item.text)
    : item.text;
}

export function groupWorkshopServices(
  workshop: Pick<Workshop, "services" | "serviceDetails">,
) {
  const groups = workshop.services.map((title) => ({
    title,
    items: [] as WorkshopServiceDetail[],
  }));
  const other = {
    title: storedSentinels.additionalServices,
    items: [] as WorkshopServiceDetail[],
  };
  const seen = new Set<string>();
  for (const [sourceIndex, original] of workshop.serviceDetails.entries()) {
    const text = normalizeServiceDetail(original);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const group =
      groups.find((g) => germanServicePatterns[g.title]?.test(text)) ??
      (groups.length === 1 ? groups[0] : other);
    group.items.push({ text, sourceIndex });
  }
  return [...groups, ...(other.items.length ? [other] : [])];
}
export type ProfileSelection = { brand: string | null; service: string | null };
export function profileSelection(
  filters: Pick<CatalogueFilters, "brand" | "service">,
): ProfileSelection {
  const brand = typeof filters.brand === "string" ? filters.brand : null,
    service = typeof filters.service === "string" ? filters.service : null;
  return {
    brand: brand && brand !== storedSentinels.allBrands ? brand : null,
    service: service && service !== storedServices.all ? service : null,
  };
}
export function workshopSelectionMatches(
  workshop: Pick<Workshop, "brands" | "services">,
  selection: ProfileSelection,
) {
  return {
    brand:
      !!selection.brand &&
      (workshop.brands.includes(selection.brand) ||
        workshop.brands.includes(storedSentinels.allBrands)),
    service:
      !!selection.service && workshop.services.includes(selection.service),
  };
}
