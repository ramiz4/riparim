import type {Locale} from "@/lib/i18n/locale";

type EmailCopy={title:string;copy:string;action:string;note:string};
type EmailKind="confirmation"|"recovery"|"published"|"needs_more";
// Only generic transactional copy belongs here. Recipient/account details and
// private review content never become template parameters.
export const emailCopy:Record<Locale,Record<EmailKind,EmailCopy>>={
 de:{
  confirmation:{title:"Bestätige deine E-Mail-Adresse bei Riparim",copy:"Bestätige deine E-Mail-Adresse, um die Registrierung abzuschließen. Melde dich anschließend separat an.",action:"E-Mail-Adresse bestätigen",note:"Wenn du kein Konto angelegt hast, kannst du diese Nachricht ignorieren."},
  recovery:{title:"Setze dein Riparim-Passwort zurück",copy:"Für dein Konto wurde eine Passwortänderung angefordert. Öffne den Link, um ein neues Passwort festzulegen.",action:"Passwort zurücksetzen",note:"Wenn du diese Änderung nicht angefordert hast, kannst du diese Nachricht ignorieren. Dein Passwort bleibt unverändert."},
  published:{title:"Deine Riparim-Bewertung wurde freigegeben",copy:"Deine Bewertung wurde geprüft und veröffentlicht. Du kannst sie nach der Anmeldung in deinen Einreichungen ansehen.",action:"Deine Einreichung nach der Anmeldung öffnen",note:"Diese Nachricht informiert dich über deine eigene Einreichung bei Riparim. Private Belege und Prüfvermerke werden ausschließlich im geschützten Kontobereich angezeigt."},
  needs_more:{title:"Bitte ergänze deinen Besuchsnachweis",copy:"Für deine Bewertung wird eine Ergänzung benötigt. Melde dich an, um den geschützten Prüfhinweis zu lesen und deinen Nachweis zu ergänzen.",action:"Deine Einreichung nach der Anmeldung öffnen",note:"Diese Nachricht informiert dich über deine eigene Einreichung bei Riparim. Private Belege und Prüfvermerke werden ausschließlich im geschützten Kontobereich angezeigt."},
 },
 sq:{
  confirmation:{title:"Konfirmo adresën tënde të emailit në Riparim",copy:"Konfirmo adresën tënde të emailit për të përfunduar regjistrimin. Pastaj hyr veçmas në llogari.",action:"Konfirmo adresën e emailit",note:"Nëse nuk ke krijuar llogari, mund ta shpërfillësh këtë mesazh."},
  recovery:{title:"Rivendos fjalëkalimin tënd të Riparim",copy:"U kërkua ndryshimi i fjalëkalimit për llogarinë tënde. Hap lidhjen për të vendosur një fjalëkalim të ri.",action:"Rivendos fjalëkalimin",note:"Nëse nuk e ke kërkuar këtë ndryshim, mund ta shpërfillësh këtë mesazh. Fjalëkalimi yt mbetet i pandryshuar."},
  published:{title:"Vlerësimi yt në Riparim u miratua",copy:"Vlerësimi yt u shqyrtua dhe u publikua. Pas hyrjes në llogari, mund ta shohësh te dërgesat e tua.",action:"Hap dërgesën tënde pas hyrjes në llogari",note:"Ky mesazh të njofton për dërgesën tënde në Riparim. Dëshmitë private dhe shënimet e shqyrtimit shfaqen vetëm në pjesën e mbrojtur të llogarisë."},
  needs_more:{title:"Plotëso dëshminë e vizitës tënde",copy:"Vlerësimi yt ka nevojë për plotësim. Hyr në llogari për të lexuar shënimin e mbrojtur të shqyrtimit dhe për të plotësuar dëshminë tënde.",action:"Hap dërgesën tënde pas hyrjes në llogari",note:"Ky mesazh të njofton për dërgesën tënde në Riparim. Dëshmitë private dhe shënimet e shqyrtimit shfaqen vetëm në pjesën e mbrojtur të llogarisë."},
 },
 en:{
  confirmation:{title:"Confirm your email address for Riparim",copy:"Confirm your email address to complete registration. Then sign in separately.",action:"Confirm email address",note:"If you did not create an account, you can ignore this message."},
  recovery:{title:"Reset your Riparim password",copy:"A password change was requested for your account. Open the link to choose a new password.",action:"Reset password",note:"If you did not request this change, you can ignore this message. Your password remains unchanged."},
  published:{title:"Your Riparim review was approved",copy:"Your review was checked and published. After signing in, you can view it in your submissions.",action:"Open your submission after signing in",note:"This message concerns your own submission to Riparim. Private evidence and review notes are shown only in the protected account area."},
  needs_more:{title:"Please add to your visit evidence",copy:"Your review needs more information. Sign in to read the protected review note and add to your evidence.",action:"Open your submission after signing in",note:"This message concerns your own submission to Riparim. Private evidence and review notes are shown only in the protected account area."},
 },
};
export const escapeEmailHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
export function emailHtml(locale:Locale,copy:EmailCopy,url:string){
 const escaped=(field:keyof EmailCopy)=>escapeEmailHtml(copy[field]);
 return `<!doctype html><html lang="${locale}" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escaped("title")}</title><style>@media(prefers-color-scheme:dark){body,.email-content{background:#102d27!important;color:#e8f5ef!important}.email-action{background:#c5efe0!important;color:#102d27!important}}</style></head><body lang="${locale}" dir="ltr" style="margin:0;background:#ffffff;color:#173c35;font-family:Arial,sans-serif"><div lang="${locale}" dir="ltr" class="email-content" style="max-width:600px;margin:0 auto;padding:28px 22px;font-size:17px;line-height:1.6;overflow-wrap:anywhere;background:#ffffff;color:#173c35"><p style="font-weight:bold">Riparim</p><h1 style="font-size:25px;line-height:1.3">${escaped("title")}</h1><p>${escaped("copy")}</p><p><a class="email-action" href="${escapeEmailHtml(url)}" style="display:inline-block;padding:12px 18px;background:#205d52;color:#ffffff;font-weight:bold;text-decoration:underline;border-radius:6px">${escaped("action")}</a></p><p style="font-size:16px">${escaped("note")}</p></div></body></html>`;
}
export function emailText(copy:EmailCopy,url:string){return `${copy.title}\n\n${copy.copy}\n\n${copy.action}:\n${url}\n\n${copy.note}`;}
