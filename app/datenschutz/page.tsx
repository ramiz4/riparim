import type {Metadata} from "next";
import Link from "next/link";
import {Brand} from "@/components/brand";
import {DirectoryFooter} from "@/components/directory-footer";
import "./privacy.css";

export const metadata:Metadata={title:"Datenschutz · Riparim",description:"Informationen zur Anmeldung, Bewertungen, privaten Besuchsnachweisen und Google-Diensten bei Riparim."};

export default function PrivacyPage(){
 return <>
  <header className="header wrap privacy-header"><Brand/><Link href="/">Zur Startseite</Link></header>
  <main className="privacy-page">
   <h1>Datenschutz bei Riparim</h1>
   <p className="privacy-date">Stand: 4. Oktober 2026</p>
   <p>Bei Fragen zum Datenschutz oder einer Bitte um Löschung deiner Kontodaten erreichst du uns unter <a href="mailto:ramizloki82@googlemail.com">ramizloki82@googlemail.com</a>.</p>
   <section aria-labelledby="privacy-account"><h2 id="privacy-account">Anmeldung und Konto</h2>
    <p>Riparim verwendet Supabase für die Anmeldung und Verwaltung von Nutzerkonten. Bei der E-Mail-Anmeldung verarbeitet Supabase deine E-Mail-Adresse, dein Passwort und gegebenenfalls deinen angegebenen Namen.</p>
    <p>Wenn du „Mit Google anmelden“ wählst, erhalten Supabase und Riparim deine Google-Konto-ID, E-Mail-Adresse, deren Bestätigungsstatus und grundlegende Profilinformationen wie deinen Namen. Wir verwenden diese Daten, um dich anzumelden, dein Konto zuzuordnen und den Zugriff auf deine eigenen Einreichungen zu prüfen. Die angeforderten Google-Berechtigungen beschränken sich auf <code>openid</code>, <code>email</code> und <code>profile</code>.</p>
    <p>Riparim prüft die Google-Identität zusätzlich auf dem Server. In den Anmelde-Cookies werden anschließend die Supabase-Sitzungsdaten gespeichert. Einreichungen aus einem früheren ChatGPT-Zugang werden nur bei bestätigtem bisherigen Zugang und übereinstimmender E-Mail-Adresse verknüpft.</p>
   </section>
   <section aria-labelledby="privacy-cookies"><h2 id="privacy-cookies">Cookies und Schutz der Anmeldung</h2>
    <p>Für die Anmeldung verwendet Riparim technisch erforderliche Cookies zur Speicherung und Erneuerung deiner Sitzung. Ein kurzlebiges Cookie sichert den Ablauf der Google-Anmeldung und wird beim Rücksprung entfernt.</p>
    <p>Zum Schutz vor zu vielen Anmeldeversuchen verarbeitet Riparim gehashte Kennungen aus IP-Adresse und gegebenenfalls E-Mail-Adresse sowie Versuchszähler. Diese Schutzdaten und internen Sitzungszuordnungen haben Ablaufzeitpunkte und werden im weiteren Betrieb bereinigt.</p>
    <p>Deine Einstellung für das helle oder dunkle Erscheinungsbild wird lokal in deinem Browser gespeichert.</p>
   </section>
   <section aria-labelledby="privacy-reviews"><h2 id="privacy-reviews">Bewertungen und private Besuchsnachweise</h2>
    <p>Wenn du eine Bewertung einreichst, speichern wir die gewählte Werkstatt, Besuchsdatum, Fahrzeug, durchgeführte Arbeit, Anzeigename, Sterne und Bewertungstext. Hinzu kommen die Nachweisart, gegebenenfalls deine Hinweise, hochgeladene Dateien und Prüfvermerke.</p>
    <p>Die Verwaltung prüft Bewertung und Nachweis manuell. Nach Freigabe werden <strong>Anzeigename, Fahrzeug, Arbeit, Besuchsdatum, Sterne und Bewertungstext</strong> öffentlich angezeigt. Deine Nachweisdateien und Hinweise zum Beleg sind für dein Konto und die zuständige Verwaltung zugänglich.</p>
    <p>Du kannst persönliche Angaben in einem Beleg vor dem Hochladen schwärzen; Werkstatt, Datum und Arbeit müssen für die Prüfung erkennbar bleiben. Fahrzeugmodell, Baujahr, Problembeschreibung und Reisezeitraum werden für die Suche im Arbeitsspeicher des aktuellen Browserlaufs gehalten. Allgemeine Suchfilter wie Marke, Ort und Leistung stehen in der Such-URL. Wenn du WhatsApp öffnest, wird der von dir überprüfbare Nachrichtentext an WhatsApp übergeben; du sendest die Nachricht dort selbst.</p>
   </section>
   <section aria-labelledby="privacy-storage"><h2 id="privacy-storage">Dienste und Speicherung</h2>
    <p>Die Website verwendet die Hosting-Infrastruktur von OpenAI Sites mit Cloudflare. Einreichungen und Prüfvermerke werden in einer Datenbank gespeichert, Nachweisdateien in einem privaten Dateispeicher. Supabase verarbeitet die für dein Nutzerkonto und deine Anmeldung erforderlichen Daten.</p>
   </section>
   <section aria-labelledby="privacy-google"><h2 id="privacy-google">Google Maps und Places</h2>
    <p>Riparim verwendet Google Maps und Places für Werkstattkarten, Fotos, Öffnungszeiten und Google-Bewertungen. Beim Laden dieser Inhalte verbindet sich dein Browser mit Google. Dabei erhält Google technisch erforderliche Verbindungsdaten, darunter deine IP-Adresse, und Angaben zum aufgerufenen Werkstattort.</p>
    <p>Unser Server gleicht Werkstätten anhand ihrer Verzeichnisangaben mit Google Places ab. Riparim speichert dafür die Google-Ortskennung und eigene Abgleichinformationen. Aktuelle Google-Bewertungen, Öffnungszeiten und Fotos werden für die Anzeige abgerufen.</p>
    <p>Weitere Informationen findest du in den Datenschutzhinweisen von <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google</a> und <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase</a>.</p>
   </section>
   <section aria-labelledby="privacy-deletion"><h2 id="privacy-deletion">Löschung und Speicherdauer</h2>
    <p>Einreichungen bleiben gespeichert, bis du sie unter „Meine Bewertungen“ löschst. Diese Funktion entfernt die gesamte Einreichung einschließlich Bewertung, privatem Nachweis und zugehörigen Dateien aus dem aktiven Speicher.</p>
    <p>Die Löschung einer Einreichung und das Abmelden entfernen dein Supabase-Nutzerkonto nicht. Für Fragen zur Speicherung oder eine Bitte um Löschung deiner Kontodaten schreibe an <a href="mailto:ramizloki82@googlemail.com">ramizloki82@googlemail.com</a>.</p>
   </section>
  </main>
  <DirectoryFooter/>
 </>;
}
