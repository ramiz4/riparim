import type { CheckedMessages, MessageShape } from "./message-contract";
const check = <const C extends MessageShape<typeof cityDe>>(
  value: C & CheckedMessages<typeof cityDe, C>,
) => value;
export const cityDe = {
  title: "Werkstätten in {city} · Riparim",
  description:
    "Veröffentlichte Werkstätten in {city}: Leistungen und Standorte vergleichen, Profile öffnen und den Betrieb direkt kontaktieren.",
  heading: "Werkstätten in {city}",
  results: "Veröffentlichte Profile in {city}",
  services: "Leistungen in dieser Auswahl",
  serviceHelp:
    "Diese Links öffnen das Verzeichnis mit Stadt und Leistung als Filter. Die Angaben stammen aus den veröffentlichten Profilen.",
  serviceCount: "{service} · {count}",
  refine: "Suche in {city} verfeinern",
  all: "Alle Werkstätten in Kosovo",
  contactTitle: "Vor dem Besuch klären",
  contactHelp:
    "Öffne das Profil für Adresse, Kontakt und Quellen. Besprich dein Fahrzeug, den Arbeitsumfang, Preis und Termin direkt mit dem Betrieb. Angaben sind keine Qualitätsgarantie; eine Kontaktaktion ist keine Buchung.",
  empty:
    "Für {city} ist momentan kein Profil veröffentlicht. Suche im gesamten Verzeichnis oder versuche es später erneut.",
  prishtina:
    "Starte mit der benötigten Leistung in Prishtina. Vergleiche die im Profil genannten Arbeiten und Marken und frage beim Betrieb nach, ob dein konkretes Fahrzeug und Problem abgedeckt sind.",
  prizren:
    "Plane deinen Werkstattbesuch in Prizren anhand der Profiladressen. Öffne die Standortangaben, bevor du losfährst, und bestätige Annahmeort und Termin direkt mit dem Betrieb.",
  ferizaj:
    "Bereite deine Anfrage an eine Werkstatt in Ferizaj vor: Fahrzeugmodell, Baujahr und eine kurze Beschreibung des Problems helfen beim Gespräch. Einen verbindlichen Arbeitsumfang vereinbarst du mit dem Betrieb.",
  peja: "Vergleiche für deinen Werkstattbesuch in Peja die dokumentierten Leistungen. Kläre vorab, ob eine Untersuchung erforderlich ist und welche Informationen der Betrieb für eine Einschätzung braucht.",
  gjakova:
    "Prüfe bei der Werkstattsuche in Gjakova die Quellen und das Datendatum im Profil. Bestätige erreichbare Kontaktwege und aktuelle Verfügbarkeit persönlich, bevor du deine Fahrt planst.",
} as const;
export const citySq = check({
  title: "Servise në {city} · Riparim",
  description:
    "Servise të publikuara në {city}: krahaso shërbimet dhe vendndodhjet, hap profilet dhe kontakto drejtpërdrejt biznesin.",
  heading: "Servise në {city}",
  results: "Profile të publikuara në {city}",
  services: "Shërbimet në këtë përzgjedhje",
  serviceHelp:
    "Këto lidhje hapin listën me qytetin dhe shërbimin si filtra. Të dhënat vijnë nga profilet e publikuara.",
  serviceCount: "{service} · {count}",
  refine: "Përshtat kërkimin në {city}",
  all: "Të gjitha serviset në Kosovë",
  contactTitle: "Çfarë të sqarosh para vizitës",
  contactHelp:
    "Hap profilin për adresën, kontaktin dhe burimet. Diskuto automjetin, punën, çmimin dhe terminin drejtpërdrejt me biznesin. Të dhënat nuk janë garanci cilësie; një veprim kontakti nuk është rezervim.",
  empty:
    "Për {city} për momentin nuk ka profil të publikuar. Kërko në të gjithë listën ose provo përsëri më vonë.",
  prishtina:
    "Fillo me shërbimin që të nevojitet në Prishtina. Krahaso punët dhe markat e përmendura në profil dhe pyet biznesin nëse mbulon automjetin dhe problemin tënd konkret.",
  prizren:
    "Planifiko vizitën në servis në Prizren sipas adresave në profile. Hap vendndodhjen para se të nisesh dhe konfirmo vendin e pranimit dhe terminin drejtpërdrejt me biznesin.",
  ferizaj:
    "Përgatit kërkesën për një servis në Ferizaj: modeli i automjetit, viti i prodhimit dhe një përshkrim i shkurtër i problemit ndihmojnë në bisedë. Punën përfundimtare e përcakton me biznesin.",
  peja: "Për vizitën në servis në Peja, krahaso shërbimet e dokumentuara. Sqaro paraprakisht nëse nevojitet kontroll dhe cilat të dhëna i duhen biznesit për një vlerësim.",
  gjakova:
    "Kur kërkon servis në Gjakova, kontrollo burimet dhe datën e të dhënave në profil. Konfirmo personalisht kontaktin dhe disponueshmërinë aktuale para se të planifikosh udhëtimin.",
} as const);
export const cityEn = check({
  title: "Workshops in {city} · Riparim",
  description:
    "Published workshops in {city}: compare services and locations, open profiles and contact the business directly.",
  heading: "Workshops in {city}",
  results: "Published profiles in {city}",
  services: "Services in this selection",
  serviceHelp:
    "These links open the directory filtered by city and service. Information comes from the published profiles.",
  serviceCount: "{service} · {count}",
  refine: "Refine your search in {city}",
  all: "All workshops in Kosovo",
  contactTitle: "Before your visit",
  contactHelp:
    "Open the profile for its address, contact details and sources. Discuss your vehicle, the work, price and appointment directly with the business. Information is no quality guarantee; a contact action is no booking.",
  empty:
    "No profile is currently published for {city}. Search the full directory or try again later.",
  prishtina:
    "Start with the service you need in Prishtina. Compare the work and brands listed in each profile, then ask whether the business covers your specific vehicle and problem.",
  prizren:
    "Plan your workshop visit in Prizren using the profile addresses. Open the location details before travelling and confirm the reception point and appointment directly with the business.",
  ferizaj:
    "Prepare your enquiry to a workshop in Ferizaj: the vehicle model, year and a brief description of the problem help the conversation. Agree the final scope of work with the business.",
  peja: "Compare the documented services for your workshop visit in Peja. Check in advance whether an inspection is needed and what information the business needs to assess the work.",
  gjakova:
    "When looking for a workshop in Gjakova, check each profile's sources and data date. Confirm the contact details and current availability personally before planning your journey.",
} as const);
