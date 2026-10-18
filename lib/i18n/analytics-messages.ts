import type { Locale } from "./locale";
import { defineMessages, type MessageShape } from "./message-contract";

const de = {
  title: "Optionale Nutzungsanalyse",
  description:
    "Dürfen wir mit PostHog in der EU messen, welche öffentlichen Seiten besucht und welche Werkstattkontakte angeklickt werden? Dafür speichern wir eine zufällige Browserkennung. Kontodaten, Formulare und Nachrichten werden nicht erfasst.",
  accept: "Analyse erlauben",
  decline: "Ablehnen",
  revoke: "Einwilligung widerrufen",
  privacy: "Datenschutz",
  settings:
    "Du kannst deine Entscheidung jederzeit hier ändern. Ohne Einwilligung bleibt die optionale Analyse ausgeschaltet. Deine Auswahl wird für 180 Tage in diesem Browser gespeichert.",
  accepted: "Optionale Analyse ist eingeschaltet.",
  declined: "Optionale Analyse ist ausgeschaltet.",
  unavailable: "Optionale Analyse ist in dieser Umgebung nicht aktiviert.",
} as const;
const sq = defineMessages<typeof de>()({
  title: "Analiza opsionale e përdorimit",
  description:
    "A na lejon të matim me PostHog në BE cilat faqe publike vizitohen dhe cilat kontakte servisesh klikohen? Për këtë ruajmë një identifikues të rastësishëm të shfletuesit. Nuk regjistrojmë të dhëna llogarie, formularë apo mesazhe.",
  accept: "Lejo analizën",
  decline: "Refuzo",
  revoke: "Tërhiq pëlqimin",
  privacy: "Privatësia",
  settings:
    "Mund ta ndryshosh vendimin tënd këtu në çdo kohë. Pa pëlqim, analiza opsionale mbetet e fikur. Zgjedhja jote ruhet në këtë shfletues për 180 ditë.",
  accepted: "Analiza opsionale është e aktivizuar.",
  declined: "Analiza opsionale është e çaktivizuar.",
  unavailable: "Analiza opsionale nuk është e aktivizuar në këtë mjedis.",
});
const en = defineMessages<typeof de>()({
  title: "Optional usage analytics",
  description:
    "May we use PostHog in the EU to measure visits to public pages and clicks on workshop contacts? We store a random browser identifier for this. Account data, forms and messages are not recorded.",
  accept: "Allow analytics",
  decline: "Decline",
  revoke: "Withdraw consent",
  privacy: "Privacy",
  settings:
    "You can change your choice here at any time. Optional analytics stays off without consent. Your choice is stored in this browser for 180 days.",
  accepted: "Optional analytics is on.",
  declined: "Optional analytics is off.",
  unavailable: "Optional analytics is not enabled in this environment.",
});
export const analyticsMessages = { de, sq, en } satisfies Record<
  Locale,
  MessageShape<typeof de>
>;
