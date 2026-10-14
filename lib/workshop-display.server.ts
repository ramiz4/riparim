import catalogue from "@/data/workshops.json";
import overlay from "@/data/workshop-translations.json";

import type { Locale } from "./i18n/locale";
import type { WorkshopDisplayById } from "./workshop-profile-content";
import {
  workshopTranslationSourceHash,
  parseWorkshopTranslations,
  type WorkshopTranslationSource,
  type WorkshopTranslations,
} from "./workshop-translations";
// This module is imported only by server pages/routes. Canonical data never changes.
function displayAdapter(
  sources: WorkshopTranslationSource[],
  translations: WorkshopTranslations,
) {
  const originals = new Map(sources.map((w) => [w.id, w])),
    entries = new Map(translations.workshops.map((w) => [w.id, w]));
  const knownHashes = new Map<string, Promise<string>>();
  return async (
    workshops: WorkshopTranslationSource[],
    locale: Locale,
  ): Promise<WorkshopDisplayById> => {
    const displayById: WorkshopDisplayById = {};
    await Promise.all(
      workshops
        .filter((w) => w.status === "published")
        .map(async (workshop) => {
          const actualHash = await workshopTranslationSourceHash(workshop),
            source = originals.get(workshop.id),
            entry = entries.get(workshop.id);
          if (locale !== "de" && entry?.sourceHash === actualHash) {
            displayById[workshop.id] = entry[locale];
            return;
          }
          if (source && !knownHashes.has(source.id))
            knownHashes.set(source.id, workshopTranslationSourceHash(source));
          const knownGerman =
            source && actualHash === (await knownHashes.get(source.id));
          displayById[workshop.id] = {
            specialty: workshop.specialty,
            description: workshop.description,
            serviceDetails: workshop.serviceDetails,
            phoneNote: workshop.phoneNote,
            sourceTitles: workshop.sources.map((s) => s.title),
            ...(locale !== "de"
              ? { fallback: entry ? ("stale" as const) : ("missing" as const) }
              : {}),
            ...(knownGerman ? { originalLanguage: "de" as const } : {}),
          };
        }),
    );
    return displayById;
  };
}
export function createWorkshopDisplayAdapter(
  sources: WorkshopTranslationSource[],
  input: unknown,
) {
  return displayAdapter(sources, parseWorkshopTranslations(input, sources));
}
// CI validates both immutable collections. Live text still receives a fresh hash below.
export const workshopDisplayById = displayAdapter(
  catalogue.workshops as WorkshopTranslationSource[],
  overlay as WorkshopTranslations,
);
