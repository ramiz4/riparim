// This bounded editorial selection owns route and sitemap identities. Catalogue
// membership is exact and remains independent of addresses or nearby locations.
export const workshopCities = [
  { slug: "prishtina", name: "Prishtina" },
  { slug: "prizren", name: "Prizren" },
  { slug: "ferizaj", name: "Ferizaj" },
  { slug: "peja", name: "Peja" },
  { slug: "gjakova", name: "Gjakova" },
] as const;
export type WorkshopCity = (typeof workshopCities)[number];
export const cityPagePaths = workshopCities.map(
  ({ slug }) => `/workshops/${slug}`,
);
export function workshopCity(slug: string): WorkshopCity | undefined {
  return workshopCities.find((city) => city.slug === slug);
}
export function cityWorkshops<T extends { status: string; city: string }>(
  directory: T[],
  city: WorkshopCity,
) {
  return directory.filter(
    (workshop) =>
      workshop.status === "published" && workshop.city === city.name,
  );
}
