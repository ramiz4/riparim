import type {Metadata} from "next";
import {getAppUser,getAdminUser} from "@/app/auth";
import {SiteHeader} from "@/components/site-header";
import {DirectoryFooter} from "@/components/directory-footer";
import "./privacy.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Datenschutz · Riparim",description:"Informationen zur Anmeldung, Bewertungen, privaten Besuchsnachweisen und Google-Diensten bei Riparim."};

export default async function PrivacyPage(){
 const user=await getAppUser(),admin=await getAdminUser(user);
 return <>
  <SiteHeader account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/>
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
   <section aria-labelledby="privacy-notifications"><h2 id="privacy-notifications">Benachrichtigungen zu deinen Einreichungen</h2>
    <p>Bei einer Bewertungsfreigabe oder einer Bitte um Nachweisergänzung senden wir eine transaktionale Nachricht an die beim Anmeldedienst bestätigte Kontoadresse. Dafür verwenden wir den bestehenden Resend-Versanddienst. Eine bestätigte Verknüpfung mit einem früheren ChatGPT-Zugang kann die zugehörige Kontaktadresse bestimmen. Ohne bestätigte Kontaktadresse wird keine Nachricht versendet.</p>
    <p>Die Nachricht enthält nur den Status und einen Link zum geschützten Kontobereich. Private Belege, Fahrzeugangaben, Bewertungstext und interne Prüfvermerke werden nicht als E-Mail-Inhalt weitergegeben. Resend verarbeitet für den Versand die Empfängeradresse, den Absender und den Nachrichteninhalt.</p>
    <p>Wir speichern ein technisches Versandereignis und für notwendige sichere Wiederholungen vorübergehend die bestätigte Adresse und den gleichbleibenden Nachrichteninhalt. Nach Übergabe an den Versanddienst werden Adresse und Inhalt aus dieser lokalen Versandtabelle entfernt. Eine Einreichungs- oder Kontolöschung entfernt zugehörige lokale Versandereignisse. Bereits vom Versanddienst angenommene Nachrichten können damit nicht aus dem E-Mail-Postfach zurückgerufen werden.</p>
   </section>
   <section aria-labelledby="privacy-business"><h2 id="privacy-business">Inhabernachweise und Betriebsprofile</h2>
    <p>Wenn du ein Werkstattprofil beanspruchst, speichern wir deine Kontozuordnung, die betroffene Werkstatt, deine private Inhaberbegründung, gegebenenfalls Beleglinks sowie Antragsstatus und Prüfvermerke. Diese Nachweise sehen ausschließlich dein Konto und die zuständige Verwaltung. Die Verwaltung prüft sie unabhängig und bestätigt oder lehnt den Antrag mit Begründung ab.</p>
    <p>Bestätigte Betriebsinhaber können Kontaktangaben, Leistungen und Beschreibung als Entwurf einreichen. Erst eine Freigabe übernimmt diese Angaben in das öffentliche Werkstattprofil. Die zuletzt freigegebenen Angaben bleiben bis dahin sichtbar. Mit einer Kontolöschung werden private Anträge, Entwürfe und Betriebszuordnungen entfernt; unabhängig gepflegte Katalogprofile und deren freigegebene Betriebsangaben bleiben bestehen.</p>
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
    <p>Unter „Einstellungen“ kannst du deinen Kontonamen ändern. Die Anzeigenamen bestehender Bewertungen bleiben unverändert; du kannst sie unter „Meine Bewertungen“ bearbeiten.</p>
    <p>Google- und E-Mail-Konten können unter „Einstellungen“ nach erneuter Identitätsbestätigung und ausdrücklicher Bestätigung gelöscht werden. Dabei entfernen wir das Supabase-Konto, alle zugeordneten Bewertungen und Besuche, private Nachweisdateien, Sitzungszuordnungen und bestätigte Verknüpfungen zu früheren ChatGPT-Einreichungen. Dein Google-Konto bleibt bestehen. Administrationszugänge benötigen vorher eine geregelte Übergabe durch die Verwaltung.</p>
    <p>Begonnene Löschungen sperren den Zugriff sofort. Bei einem Teilfehler kannst du die Bereinigung in demselben Browser innerhalb von sieben Tagen wiederholen; danach unterstützt die Verwaltung die Fortsetzung. Dafür speichern wir eine gehashte, ausschließlich zur Löschung berechtigende Kennung und ein technisch erforderliches, geschütztes Cookie. Eine noch nicht begonnene Löschung erfordert nach zehn Minuten eine neue Identitätsbestätigung. Minimale Sperrkennungen bleiben erhalten, damit alte Sitzungen oder frühere ChatGPT-Zugänge nicht erneut Zugriff erhalten.</p>
    <p>Die Löschung einer Einreichung und das Abmelden entfernen dein Supabase-Nutzerkonto nicht. Für Fragen zur Speicherung oder Hilfe bei der Kontolöschung schreibe an <a href="mailto:ramizloki82@googlemail.com">ramizloki82@googlemail.com</a>.</p>
   </section>
  </main>
  <DirectoryFooter/>
 </>;
}
