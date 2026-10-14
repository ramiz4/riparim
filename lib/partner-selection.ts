import type { Workshop } from "./workshops";
// A fresh shuffle per load gives every eligible profile an equal chance.
export function selectPartnerWorkshops(
  workshops: Workshop[],
  random = Math.random,
) {
  const candidates = workshops.filter(
    (workshop) => workshop.status === "published",
  );
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, 3);
}
