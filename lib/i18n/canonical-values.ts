// Existing persisted/form values. English semantic names never change their bytes.
export const storedServices = {
  all: "Alle Leistungen",
  maintenance: "Inspektion & Wartung",
  diagnostics: "Diagnose & Elektronik",
  brakes: "Bremsen & Fahrwerk",
  engine: "Motor & Getriebe",
  bodywork: "Karosserie & Lack",
  tires: "Reifen & Klima",
} as const;
export const storedSentinels = {
  allServices: storedServices.all,
  allCities: "Ganz Kosovo",
  allBrands: "Alle Marken",
  allLanguages: "Alle Sprachen",
  additionalServices: "Weitere Leistungen",
} as const;
export const storedEvidenceTypes = {
  invoice: "Rechnung",
  workOrder: "Service- oder Arbeitsbeleg",
  other: "Anderer Nachweis",
} as const;
export const storedLanguages = {
  albanian: "Albanisch",
  german: "Deutsch",
  english: "Englisch",
} as const;

export const evidenceTypes: readonly string[] =
  Object.values(storedEvidenceTypes);

export const storedSourceLabels = { workshopMapFallback: "Werkstatt" } as const;
