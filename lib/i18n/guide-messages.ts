import type { Locale } from "./locale";

import type { GuideId } from "../guide-routes";
export { guideIds, isGuideId, type GuideId } from "../guide-routes";
type GuideSection = {
  title: string;
  text: string;
  items?: readonly string[];
};
type GuideArticle = {
  title: string;
  description: string;
  intro: string;
  sections: readonly GuideSection[];
  checklist: readonly string[];
};
type GuideMessages = {
  indexTitle: string;
  indexDescription: string;
  kicker: string;
  read: string;
  back: string;
  checklistTitle: string;
  nextTitle: string;
  nextDescription: string;
  findWorkshops: string;
  relatedTitle: string;
  sourcesTitle: string;
  sourcesNote: string;
  articles: Record<GuideId, GuideArticle>;
};
export const guideMessages: Record<Locale, GuideMessages> = {
  de: {
    indexTitle: "Werkstatt-Ratgeber für Kosovo",
    indexDescription:
      "Werkstatt auswählen, Besuch vorbereiten und Arbeit und Kosten direkt klären: praktische Schritte für deine Suche mit Riparim.",
    kicker: "Finden. Kontaktieren. Bewerten.",
    read: "Ratgeber lesen",
    back: "Alle Ratgeber",
    checklistTitle: "Deine kurze Checkliste",
    nextTitle: "Vom Ratgeber zur passenden Werkstatt",
    nextDescription:
      "Vergleiche veröffentlichte Profile nach Ort, Leistung und Beratungssprache. Kläre fehlende oder aktuelle Angaben direkt mit dem Betrieb.",
    findWorkshops: "Werkstätten in Kosovo vergleichen",
    relatedTitle: "Als Nächstes lesen",
    sourcesTitle: "Weiterführende Quellen",
    sourcesNote:
      "AAA und ADAC erläutern allgemeine Fragen zu Werkstattauswahl und Reparaturauftrag. Die Tipps hier sind praktische Orientierung; ausländische Rechtsregeln werden nicht auf Kosovo übertragen.",
    articles: {
      "choosing-a-workshop": {
        title: "Eine Werkstatt in Kosovo auswählen",
        description:
          "Vergleiche Leistungen, Standort und Bewertungen und stelle vor dem Besuch die richtigen Fragen zu deinem Fahrzeug und Auftrag.",
        intro:
          "Die passende Werkstatt muss zu deinem konkreten Anliegen passen. Mit Riparim kannst du eine überschaubare Auswahl zusammenstellen und anschließend direkt mit den Betrieben sprechen. Ein veröffentlichter Eintrag allein sagt noch nicht, ob dein Auftrag dort richtig aufgehoben ist.",
        sections: [
          {
            title: "1. Beschreibe zuerst deinen Bedarf",
            text: "Notiere Fahrzeugmarke, Modell und dein Anliegen: geplante Wartung, eine beschädigte Karosserie oder ein noch ungeklärtes Problem. Beschreibe Beobachtungen statt eine Diagnose vorauszusetzen. So kannst du nach einer passenden Leistung suchen und im Gespräch klären, ob der Betrieb Erfahrung mit deinem Fahrzeug und dieser Arbeit hat.",
          },
          {
            title: "2. Vergleiche eine kleine Auswahl",
            text: "Filtere das Verzeichnis nach einem erreichbaren Ort und der benötigten Leistung. Öffne die Profile und vergleiche Leistungen, Marken und Kontaktmöglichkeiten. Die Entfernung zum Ortszentrum ist Luftlinie; prüfe die tatsächliche Anfahrt über die Routenfunktion. Fehlende Angaben bedeuten zunächst, dass dir eine Information fehlt, und sind kein Qualitätsurteil.",
            items: [
              "Passt das angegebene Leistungsangebot zu deinem Anliegen?",
              "Ist die Anfahrt auch für Abgabe und Abholung praktikabel?",
              "Ist eine passende Beratungssprache angegeben oder musst du sie direkt klären?",
            ],
          },
          {
            title: "3. Lies Bewertungen mit ihrem Kontext",
            text: "Achte auf die Quelle einer Bewertung und die beschriebene Arbeit. Bei Riparim erscheinen Bewertungen nach manueller Prüfung des privaten Besuchsnachweises und Freigabe. Google-Bewertungen sind eine eigene Quelle. Ein geprüfter Besuch ist keine Garantie für eine künftige Reparatur. Ohne Bewertungen fehlt Erfahrungswissen; daraus lässt sich weder gute noch schlechte Qualität ableiten.",
          },
          {
            title: "4. Kläre die offenen Punkte direkt",
            text: "Rufe über das Profil an oder nutze eine dort angebotene Kontaktmöglichkeit. Bestätige Öffnungszeiten, Beratungssprache und die Möglichkeit eines Termins. Frage, ob zuerst eine Untersuchung nötig ist, was diese umfasst und wie du danach einen verständlichen Kostenvoranschlag erhältst. Eine freundliche, konkrete Antwort hilft dir zu beurteilen, ob ihr dieselben Erwartungen habt.",
          },
          {
            title: "5. Entscheide nach nachvollziehbaren Antworten",
            text: "Vergleiche den vereinbarten Umfang, den Ablauf und die Erreichbarkeit. Ein niedriger genannter Betrag ist ohne vergleichbaren Arbeitsumfang wenig aussagekräftig. Bitte um eine Erklärung, wenn Teile oder Arbeitsschritte unklar bleiben. Auf Riparim vereinbarst du keinen Reparaturvertrag: Termin, Kosten und Auftrag klärst du selbst mit der Werkstatt.",
          },
        ],
        checklist: [
          "Fahrzeug und beobachtetes Problem notiert",
          "Passende Leistungen und erreichbaren Standort verglichen",
          "Bewertungsquelle und Grenzen der Prüfung verstanden",
          "Öffnungszeiten, Sprache und Termin direkt bestätigt",
          "Nächsten Schritt und mögliche Untersuchungskosten geklärt",
        ],
      },
      "preparing-a-visit": {
        title: "Werkstattbesuch und Kostenvoranschlag vorbereiten",
        description:
          "Halte Beobachtungen fest, frage nach einem verständlichen Kostenvoranschlag und vereinbare, wie zusätzliche Arbeiten freigegeben werden.",
        intro:
          "Ein kurzes Gespräch mit klaren Notizen erleichtert die Übergabe deines Fahrzeugs. Bereite die Informationen für die Werkstatt vor und halte fest, welche Arbeit du tatsächlich beauftragst. Riparim hilft dir, den Kontakt zu finden; die konkrete Vereinbarung triffst du direkt mit dem Betrieb.",
        sections: [
          {
            title: "1. Sammle die Informationen für das Gespräch",
            text: "Notiere Marke, Modell, Baujahr und ungefähren Kilometerstand, soweit dir bekannt. Beschreibe, seit wann und in welcher Situation das Problem auftritt. Bereits vorhandene Wartungsunterlagen können im Gespräch helfen. Du musst persönliche Fahrzeugunterlagen nicht in eine öffentliche Bewertung oder einen öffentlichen Link aufnehmen.",
            items: [
              "Was hast du bemerkt: Geräusch, Anzeige, Geruch oder verändertes Verhalten?",
              "Wann tritt es auf: beim Starten, Bremsen oder erst nach längerer Fahrt?",
              "Welche Arbeiten wurden zuletzt durchgeführt?",
            ],
          },
          {
            title: "2. Bestätige den Besuch vor der Anfahrt",
            text: "Prüfe den Standort im Profil und bestätige Öffnungszeiten und Termin direkt. Frage, wie die Fahrzeugübergabe abläuft, wann du eine Rückmeldung erwarten kannst und ob du auf die erste Untersuchung warten kannst. Teile mit, in welcher Sprache du Umfang und Kosten besprechen möchtest. Ein Kontaktklick auf Riparim bestätigt noch keinen Termin.",
          },
          {
            title: "3. Bitte um einen aufgeschlüsselten Vorschlag",
            text: "Frage nach der vorgesehenen Untersuchung und danach getrennt nach der vorgeschlagenen Reparatur. Bitte um eine verständliche Aufstellung der Arbeiten, Teile, Arbeitskosten und weiterer Kosten, die der Betrieb ansetzen möchte. Kläre, welche Positionen feststehen und welche erst nach der Untersuchung eingeschätzt werden können. Frage auch, ob die Diagnose oder die Erstellung des Vorschlags etwas kostet.",
          },
          {
            title: "4. Vereinbare Rückfragen vor Zusatzarbeiten",
            text: "Halte fest, welche Arbeiten du freigibst und wie die Werkstatt dich erreicht, wenn weitere Arbeiten vorgeschlagen werden. Bitte darum, dir den Grund und die zusätzlichen Kosten zu erklären, bevor du darüber entscheidest. Vereinbart auch, was geschieht, wenn du vorübergehend nicht erreichbar bist. Kläre die erwartete Dauer und mögliche Änderungen des Abholtermins.",
          },
          {
            title: "5. Gehe bei der Abholung den Auftrag durch",
            text: "Lass dir die durchgeführten Arbeiten und die Rechnung erklären und gleiche sie mit eurer Absprache ab. Frage nach offenen Punkten und empfohlenen nächsten Schritten, ohne zusätzliche Arbeit automatisch zu beauftragen. Bewahre deine Unterlagen privat auf. Wenn du anschließend auf Riparim bewertest, beschreibe deine eigene Erfahrung und reiche den Besuchsnachweis über das vorgesehene Formular ein; erst nach Freigabe wird die Bewertung öffentlich.",
          },
        ],
        checklist: [
          "Fahrzeugdaten, Beobachtungen und bisherige Arbeiten notiert",
          "Termin, Standort und Beratungssprache bestätigt",
          "Kosten für Untersuchung und Kostenvoranschlag erfragt",
          "Arbeitsumfang, Kostenpositionen und Rückfragen vereinbart",
          "Abholung, Rechnung und private Aufbewahrung der Unterlagen bedacht",
        ],
      },
    },
  },
  sq: {
    indexTitle: "Udhëzues për serviset në Kosovë",
    indexDescription:
      "Zgjidh servisin, përgatit vizitën dhe sqaro punën e kostot drejtpërdrejt: hapa praktikë për kërkimin me Riparim.",
    kicker: "Gjej. Kontakto. Vlerëso.",
    read: "Lexo udhëzuesin",
    back: "Të gjithë udhëzuesit",
    checklistTitle: "Lista jote e shkurtër",
    nextTitle: "Nga udhëzuesi te servisi i përshtatshëm",
    nextDescription:
      "Krahaso profilet e publikuara sipas vendit, shërbimit dhe gjuhës së këshillimit. Sqaro drejtpërdrejt me servisin të dhënat që mungojnë ose duhen konfirmuar.",
    findWorkshops: "Krahaso serviset në Kosovë",
    relatedTitle: "Lexo më pas",
    sourcesTitle: "Burime për lexim të mëtejshëm",
    sourcesNote:
      "AAA dhe ADAC shpjegojnë pyetje të përgjithshme për zgjedhjen e servisit dhe porosinë e riparimit. Këto këshilla janë orientim praktik; rregullat ligjore të vendeve të tjera nuk zbatohen këtu si rregulla të Kosovës.",
    articles: {
      "choosing-a-workshop": {
        title: "Si të zgjedhësh një servis në Kosovë",
        description:
          "Krahaso shërbimet, vendndodhjen dhe vlerësimet dhe bëj pyetjet e duhura për automjetin dhe punën para vizitës.",
        intro:
          "Servisi i përshtatshëm duhet t'i përgjigjet nevojës tënde konkrete. Me Riparim mund të krijosh një përzgjedhje të vogël dhe pastaj të flasësh drejtpërdrejt me serviset. Vetëm prania e një profili të publikuar nuk tregon nëse aty mund të kryhet puna që kërkon.",
        sections: [
          {
            title: "1. Përshkruaj fillimisht nevojën",
            text: "Shëno markën, modelin dhe arsyen e vizitës: mirëmbajtje e planifikuar, dëmtim i karrocerisë apo një problem ende i paqartë. Përshkruaj çfarë ke vërejtur pa supozuar diagnozën. Kështu mund të kërkosh shërbimin e duhur dhe të pyesësh nëse servisi ka përvojë me automjetin tënd dhe atë punë.",
          },
          {
            title: "2. Krahaso një përzgjedhje të vogël",
            text: "Filtro listën sipas një vendi të arritshëm dhe shërbimit që të duhet. Hap profilet dhe krahaso shërbimet, markat dhe mundësitë e kontaktit. Largësia nga qendra e vendit është në vijë ajrore; kontrollo udhëtimin real me funksionin e rrugës. Të dhënat që mungojnë tregojnë fillimisht mungesë informacioni, jo vlerësim të cilësisë.",
            items: [
              "A përputhen shërbimet e listuara me nevojën tënde?",
              "A është praktik udhëtimi si për dorëzim ashtu edhe për marrje?",
              "A është shënuar gjuha e përshtatshme e këshillimit apo duhet ta pyesësh drejtpërdrejt?",
            ],
          },
          {
            title: "3. Lexo vlerësimet në kontekst",
            text: "Shiko burimin e vlerësimit dhe punën që përshkruhet. Në Riparim, vlerësimet shfaqen pas kontrollit manual të dëshmisë private të vizitës dhe miratimit. Vlerësimet e Google janë burim më vete. Një vizitë e kontrolluar nuk garanton riparimet e ardhshme. Në mungesë vlerësimesh mungojnë përvoja të publikuara; nuk mund të nxirret përfundim për cilësi të mirë apo të dobët.",
          },
          {
            title: "4. Sqaro drejtpërdrejt pyetjet e hapura",
            text: "Telefono nga profili ose përdor një mundësi kontakti të ofruar aty. Konfirmo orarin, gjuhën e këshillimit dhe mundësinë e një termini. Pyet nëse duhet fillimisht një kontroll, çfarë përfshin dhe si mund të marrësh më pas një vlerësim të kuptueshëm të kostos. Një përgjigje konkrete dhe e qartë të ndihmon të kuptosh nëse pritjet tuaja përputhen.",
          },
          {
            title: "5. Vendos sipas përgjigjeve të qarta",
            text: "Krahaso punën e dakorduar, mënyrën e kryerjes dhe komunikimin. Një shumë e ulët e përmendur ka pak kuptim pa të njëjtin përshkrim të punës. Kërko shpjegim kur pjesët ose hapat janë të paqartë. Riparim nuk lidh kontratën e riparimit për ty: terminin, kostot dhe porosinë i sqaron vetë me servisin.",
          },
        ],
        checklist: [
          "Shëno automjetin dhe problemin e vërejtur",
          "Krahaso shërbimet e përshtatshme dhe vendndodhjen e arritshme",
          "Kupto burimin e vlerësimit dhe kufijtë e kontrollit",
          "Konfirmo drejtpërdrejt orarin, gjuhën dhe terminin",
          "Sqaro hapin tjetër dhe kostot e mundshme të kontrollit",
        ],
      },
      "preparing-a-visit": {
        title: "Përgatit vizitën në servis dhe vlerësimin e kostos",
        description:
          "Shëno vërejtjet, kërko një vlerësim të kuptueshëm të kostos dhe dakordohu si do të miratohen punët shtesë.",
        intro:
          "Një bisedë e shkurtër me shënime të qarta e lehtëson dorëzimin e automjetit. Përgatit informacionin për servisin dhe mbaj shënim punën që porosit. Riparim të ndihmon të gjesh kontaktin; marrëveshjen konkrete e bën drejtpërdrejt me servisin.",
        sections: [
          {
            title: "1. Mblidh informacionin për bisedën",
            text: "Shëno markën, modelin, vitin e prodhimit dhe kilometrat e përafërt, nëse i di. Përshkruaj prej kur dhe në çfarë rrethanash shfaqet problemi. Dokumentet ekzistuese të mirëmbajtjes mund të ndihmojnë në bisedë. Dokumentet personale të automjetit nuk ke nevojë t'i përfshish në një vlerësim ose lidhje publike.",
            items: [
              "Çfarë ke vërejtur: zhurmë, sinjal në panel, erë apo sjellje të ndryshuar?",
              "Kur shfaqet: gjatë ndezjes, frenimit apo pas një udhëtimi më të gjatë?",
              "Çfarë punësh janë kryer së fundmi?",
            ],
          },
          {
            title: "2. Konfirmo vizitën para nisjes",
            text: "Kontrollo vendndodhjen në profil dhe konfirmo drejtpërdrejt orarin e terminin. Pyet si bëhet dorëzimi, kur pritet përgjigjja dhe nëse mund të presësh gjatë kontrollit fillestar. Trego në cilën gjuhë dëshiron të diskutosh punën dhe kostot. Një klikim kontakti në Riparim ende nuk konfirmon një termin.",
          },
          {
            title: "3. Kërko një propozim me zëra të ndarë",
            text: "Pyet për kontrollin e parashikuar dhe veçmas për riparimin e propozuar më pas. Kërko një përshkrim të kuptueshëm të punëve, pjesëve, punës së dorës dhe kostove të tjera që servisi synon të përfshijë. Sqaro cilat shuma dihen dhe cilat mund të vlerësohen vetëm pas kontrollit. Pyet edhe nëse diagnoza ose përgatitja e propozimit ka kosto.",
          },
          {
            title: "4. Dakordohu për kontakt para punëve shtesë",
            text: "Mbaj shënim cilat punë miraton dhe si të kontakton servisi nëse propozon punë të tjera. Kërko shpjegimin e arsyes dhe kostove shtesë para se të vendosësh. Dakordohuni edhe çfarë bëhet nëse përkohësisht nuk mund të përgjigjesh. Sqaro kohëzgjatjen e pritshme dhe ndryshimet e mundshme të kohës së marrjes.",
          },
          {
            title: "5. Rishiko porosinë kur merr automjetin",
            text: "Kërko shpjegim për punët e kryera dhe faturën dhe krahasoji me marrëveshjen tuaj. Pyet për pikat e hapura dhe hapat e rekomanduar pa porositur automatikisht punë shtesë. Ruaji dokumentet privatisht. Nëse më pas vlerëson në Riparim, përshkruaj përvojën tënde dhe dërgo dëshminë e vizitës përmes formularit të paraparë; vlerësimi bëhet publik vetëm pas miratimit.",
          },
        ],
        checklist: [
          "Shëno të dhënat e automjetit, vërejtjet dhe punët e mëparshme",
          "Konfirmo terminin, vendndodhjen dhe gjuhën e këshillimit",
          "Pyet për kostot e kontrollit dhe vlerësimit të kostos",
          "Dakordohu për punën, zërat e kostos dhe kontaktin për ndryshime",
          "Planifiko marrjen, shqyrtimin e faturës dhe ruajtjen private të dokumenteve",
        ],
      },
    },
  },
  en: {
    indexTitle: "Workshop guides for Kosovo",
    indexDescription:
      "Choose a workshop, prepare your visit and discuss the work and costs directly: practical steps for your search with Riparim.",
    kicker: "Find. Contact. Review.",
    read: "Read the guide",
    back: "All guides",
    checklistTitle: "Your short checklist",
    nextTitle: "From the guide to a suitable workshop",
    nextDescription:
      "Compare published profiles by location, service and consultation language. Confirm missing or current details directly with the workshop.",
    findWorkshops: "Compare workshops in Kosovo",
    relatedTitle: "Read next",
    sourcesTitle: "Further reading",
    sourcesNote:
      "AAA and ADAC discuss general questions about choosing a workshop and arranging repairs. These tips are practical guidance; foreign legal rules are not presented as rules for Kosovo.",
    articles: {
      "choosing-a-workshop": {
        title: "How to choose a workshop in Kosovo",
        description:
          "Compare services, location and reviews, then ask the right questions about your vehicle and the job before your visit.",
        intro:
          "A suitable workshop needs to fit your particular job. Riparim helps you put together a manageable shortlist before speaking directly to the businesses. A published listing alone does not tell you whether a workshop is the right fit for your repair.",
        sections: [
          {
            title: "1. Start with what you need",
            text: "Note your vehicle make, model and reason for visiting: planned maintenance, bodywork damage or a problem that has not been diagnosed. Describe observations rather than assuming a diagnosis. You can then search for a suitable service and ask whether the workshop has experience with your vehicle and this kind of work.",
          },
          {
            title: "2. Compare a small shortlist",
            text: "Filter the directory by a reachable location and the service you need. Open the profiles and compare services, makes and contact options. Distance from a city centre is straight-line distance; check the actual journey using the directions link. Missing details mean you still need some information, rather than providing a judgment about quality.",
            items: [
              "Does the listed service match what you need?",
              "Is the journey practical for both drop-off and collection?",
              "Is a suitable consultation language listed, or do you need to ask directly?",
            ],
          },
          {
            title: "3. Read reviews in context",
            text: "Check the source of each review and the work it describes. Riparim reviews appear after a manual check of private visit evidence and approval. Google reviews are a separate source. A checked visit does not guarantee a future repair. If there are no reviews, published experience is missing; that alone establishes neither good nor poor quality.",
          },
          {
            title: "4. Ask the workshop directly",
            text: "Call from the profile or use a contact option offered there. Confirm opening hours, consultation language and appointment availability. Ask whether an initial inspection is needed, what it includes and how you can receive a clear estimate afterwards. A specific, understandable answer helps you assess whether your expectations match.",
          },
          {
            title: "5. Decide on clear answers",
            text: "Compare the agreed work, process and ability to stay in touch. A low quoted figure tells you little unless the scope is comparable. Ask for an explanation when parts or steps remain unclear. Riparim does not arrange your repair contract: you agree the appointment, costs and work directly with the workshop.",
          },
        ],
        checklist: [
          "Note the vehicle and observed problem",
          "Compare suitable services and a reachable location",
          "Understand the review source and limits of the checks",
          "Confirm opening hours, language and appointment directly",
          "Clarify the next step and any inspection costs",
        ],
      },
      "preparing-a-visit": {
        title: "Prepare your workshop visit and repair estimate",
        description:
          "Record your observations, ask for a clear estimate and agree how any additional work will be approved.",
        intro:
          "A short conversation with clear notes makes handing over your vehicle easier. Prepare the information for the workshop and keep a record of the work you actually authorize. Riparim helps you find the contact; you make the specific agreement directly with the business.",
        sections: [
          {
            title: "1. Gather the information for the conversation",
            text: "Note the make, model, year and approximate mileage where known. Describe when the problem began and the conditions in which it occurs. Existing maintenance records can help during the conversation. You do not need to put personal vehicle documents into a public review or a public link.",
            items: [
              "What did you notice: a sound, dashboard warning, smell or change in behaviour?",
              "When does it happen: starting, braking or after a longer journey?",
              "What work was carried out most recently?",
            ],
          },
          {
            title: "2. Confirm the visit before travelling",
            text: "Check the location on the profile and confirm hours and the appointment directly. Ask how drop-off works, when to expect an update and whether you can wait during the initial inspection. Say which language you would like to use to discuss the work and costs. Clicking a contact option on Riparim does not confirm an appointment.",
          },
          {
            title: "3. Ask for an itemized proposal",
            text: "Ask about the planned inspection and, separately, the proposed repair that follows. Request a clear breakdown of the jobs, parts, labour and other costs the workshop intends to include. Clarify which amounts are known and which can only be estimated after inspection. Also ask whether diagnosis or preparing the proposal has a cost.",
          },
          {
            title: "4. Agree on contact before additional work",
            text: "Record which work you authorize and how the workshop will contact you if it proposes more. Ask for the reason and additional costs to be explained before you decide. Agree what happens if you are temporarily unavailable. Clarify the expected duration and possible changes to collection time.",
          },
          {
            title: "5. Go through the job at collection",
            text: "Have the completed work and invoice explained and compare them with your agreement. Ask about unresolved points and recommended next steps without automatically ordering extra work. Keep your documents private. If you later review the workshop on Riparim, describe your own experience and submit visit evidence through the designated form; the review becomes public only after approval.",
          },
        ],
        checklist: [
          "Note vehicle details, observations and previous work",
          "Confirm the appointment, location and consultation language",
          "Ask about inspection and estimate costs",
          "Agree the work, cost breakdown and contact for changes",
          "Plan collection, invoice review and private document storage",
        ],
      },
    },
  },
};
