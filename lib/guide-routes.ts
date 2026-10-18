export const guideIds = ["choosing-a-workshop", "preparing-a-visit"] as const;
export type GuideId = (typeof guideIds)[number];
export function isGuideId(value: string): value is GuideId {
  return (guideIds as readonly string[]).includes(value);
}
// One bounded route registry serves locale routing, metadata and release assets.
export const guideRoutes = [
  { id: "/guides", de: "/ratgeber", sq: "/udhezues", en: "/guides" },
  {
    id: `/guides/${guideIds[0]}`,
    de: "/ratgeber/werkstatt-auswaehlen",
    sq: "/udhezues/zgjedhja-e-servisit",
    en: "/guides/choosing-a-workshop",
  },
  {
    id: `/guides/${guideIds[1]}`,
    de: "/ratgeber/werkstattbesuch-vorbereiten",
    sq: "/udhezues/pergatitja-e-vizites",
    en: "/guides/preparing-a-visit",
  },
] as const;
export const guidePagePaths: readonly string[] = guideRoutes.map(
  ({ id }) => id,
);
