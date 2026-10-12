import assert from 'node:assert/strict';

// Independent expectations for visible copy, shared by component and real HTTP checks.
const copy={
 de:['Stand: 12. Oktober 2026','für Riparim eingerichteten Hosting-Infrastruktur','den für Riparim eingerichteten E-Mail-Versanddienst','Der eingerichtete Versanddienst verarbeitet für den Versand die Empfängeradresse, den Absender und den Nachrichteninhalt.','Private Belege, Fahrzeugangaben, Bewertungstext und interne Prüfvermerke werden nicht als E-Mail-Inhalt weitergegeben.'],
 sq:['Përditësuar më: 12 tetor 2026','infrastrukturën e hostimit të konfiguruar për Riparim','shërbimin e dërgimit të emailit të konfiguruar për Riparim','Për dërgimin, shërbimi i konfiguruar përpunon adresën e marrësit, dërguesin dhe përmbajtjen e mesazhit.','Dëshmitë private, të dhënat e automjetit, teksti i vlerësimit dhe shënimet e brendshme të shqyrtimit nuk përcillen si përmbajtje emaili.'],
 en:['Last updated: 12 October 2026','hosting infrastructure configured for Riparim','the email sending service configured for Riparim','The configured sending service processes the recipient address, sender and message content to send the email.','Private proof, vehicle details, review text and internal review notes are not passed on as email content.'],
};
export function assertPrivacyOutput(output,locale,provider){
 for(const text of copy[locale])assert(output.includes(text),`${locale}: public privacy includes ${text}`);
 for(const name of ['OpenAI Sites','Cloudflare','Resend'])assert(!output.includes(name),`${locale}: privacy does not assume ${name} for every installation`);
 const selected=provider==='pocketbase'?'https://pocketbase.io/docs/authentication/':'https://supabase.com/privacy',other=provider==='pocketbase'?'https://supabase.com/privacy':'https://pocketbase.io/docs/authentication/';
 assert(output.includes(selected)&&!output.includes(other),`${locale}: public privacy keeps only the selected auth provider link`);
}
