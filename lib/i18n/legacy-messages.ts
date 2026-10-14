// Existing German API text is a compatibility contract, separate from localized UI copy.
// Callers preserve HTTP status and English source-owned codes.
export const legacyMessages = {
  passengerCarScopeExclusion:
    "Lkw-, Bus- oder Tachografbetrieb: kein bestätigter Pkw-Werkstatteintrag.",
  anotherClaimApproved: "Ein anderer Übernahme-Antrag wurde bestätigt.",
  pendingDeletionName: (subject: string) => `Begonnene Löschung (${subject})`,
  anonymousAccountName: "Anonym",
  invalidRequest: "Ungültige Anfrage.",
  invalidAction: "Ungültige Aktion.",
  invalidInputs: "Ungültige Eingaben.",
  checkInputs: "Bitte prüfe die Eingaben.",
  checkDetails: "Bitte prüfe die Angaben.",
  checkName: "Bitte prüfe den Namen.",
  googleOrEmailRequired: "Bitte melde dich mit Google oder E-Mail an.",
  authenticationRequired: "Bitte melde dich an.",
  reviewAuthenticationRequired:
    "Bitte melde dich an, bevor du eine Bewertung einreichst.",
  evidenceAuthenticationRequired:
    "Bitte melde dich an, um deine Nachweise zu sehen.",
  accountDeletionStarted: "Die Kontolöschung wurde bereits begonnen.",
  accountBlocked: "Dieses Konto ist gesperrt.",
  accountBlockedContactAdmin:
    "Dieses Konto ist gesperrt. Bitte wende dich an die Verwaltung.",
  reviewAccountBlocked:
    "Dein Konto ist gesperrt. Bitte melde dich bei der Verwaltung.",
  businessAccountBlocked: "Dein Konto ist gesperrt.",
  selfDeletionProtected: "Dieses Konto kann hier nicht gelöscht werden.",
  adminSelfDeletionProtected:
    "Administrationszugänge sind gegen eigene Löschung geschützt.",
  originalAdminProtected: "Der ursprüngliche Verwaltungszugang ist geschützt.",
  rateLimited: "Zu viele Versuche. Bitte warte einige Minuten.",
  retryRateLimited:
    "Zu viele Versuche. Bitte warte einige Minuten und versuche es erneut.",
  registrationRateLimited:
    "Zu viele Registrierungsversuche. Bitte warte einige Minuten und versuche es erneut.",
  authConfigForbidden: "Kein Zugriff auf die Konfiguration.",
  moderationForbidden: "Kein Zugriff auf die Prüfung.",
  notificationsForbidden: "Kein Zugriff auf den Benachrichtigungsversand.",
  usersForbidden: "Kein Zugriff auf die Benutzerverwaltung.",
  adminForbidden: "Kein Zugriff auf die Verwaltung.",
  emailDeliveryUnavailable:
    "Der E-Mail-Versand ist derzeit noch nicht verfügbar. Bitte versuche es später erneut.",
  emailLoginUnavailable:
    "E-Mail-Anmeldung ist gerade nicht verfügbar. Bitte versuche es später erneut.",
  authSetupPending:
    "Die Anmeldung wird gerade eingerichtet. Bitte versuche es später erneut.",
  authUnavailable:
    "Die Anmeldung ist gerade nicht verfügbar. Bitte versuche es später erneut.",
  recoveryLinkOrLoginRequired:
    "Öffne zuerst den gültigen Link aus deiner E-Mail oder melde dich an.",
  recoveryLinkRequired: "Bitte öffne einen gültigen Wiederherstellungslink.",
  logoutFailed: "Abmelden fehlgeschlagen. Bitte versuche es erneut.",
  confirmationDeliveryUnavailable:
    "Die Bestätigungs-E-Mail kann derzeit nicht gesendet werden. Bitte versuche es später erneut.",
  confirmationUnavailable:
    "Die E-Mail-Bestätigung ist gerade nicht verfügbar. Bitte versuche es später erneut.",
  registrationCheckInputs:
    "Registrierung konnte gerade nicht abgeschlossen werden. Prüfe die Eingaben oder versuche es später erneut.",
  registrationFailed:
    "Die Registrierung konnte gerade nicht abgeschlossen werden. Bitte versuche es später erneut.",
  confirmationSent:
    "Prüfe dein Postfach und bestätige deine E-Mail-Adresse. Danach kannst du dich anmelden.",
  recoverySent:
    "Wenn ein Konto existiert, erhältst du einen Link zum Zurücksetzen.",
  passwordUpdated: "Dein Passwort wurde geändert. Bitte melde dich erneut an.",
  businessDocumentsTooLarge:
    "Die Dokumente sind zusammen zu groß. Maximal 10 MB.",
  invalidUpload: "Bitte lade eine gültige Datei hoch.",
  invalidEvidenceFile:
    "Bitte lade eine gültige PDF-, JPG- oder PNG-Datei hoch.",
  invalidWorkshop: "Ungültige Werkstatt.",
  workshopNotFound: "Werkstatt nicht gefunden.",
  evidenceNotFound: "Nachweis nicht gefunden.",
  submissionNotFound:
    "Diese Einreichung gehört nicht zu deinem Konto oder wurde gelöscht.",
  googleDataUnavailable: "Google-Angaben sind gerade nicht verfügbar.",
  workshopDataUnavailable:
    "Die Werkstattdaten sind gerade nicht verfügbar. Bitte versuche es erneut.",
  invalidPage: "Ungültige Seitenangabe.",
  notificationOverviewUnavailable:
    "Die Versandübersicht ist gerade nicht verfügbar.",
  invalidVisit:
    "Bitte prüfe Werkstatt, Besuchsdatum, Fahrzeug, Leistung und Nachweisart.",
  publishedWorkshopRequired: "Bitte wähle eine veröffentlichte Werkstatt.",
  invalidReviewId: "Ungültige Kennung.",
  reviewEditConflict:
    "Die Bewertung kann gerade nicht bearbeitet werden. Bitte aktualisiere deine Bewertungen.",
  submissionRemovedOrChanged:
    "Die Einreichung wurde inzwischen gelöscht oder geändert. Bitte aktualisiere deine Bewertungen.",
  reviewChanged:
    "Die Bewertung wurde zwischenzeitlich geändert. Bitte aktualisiere deine Bewertungen.",
  moderationReviewChanged:
    "Die Bewertung wurde zwischenzeitlich geändert. Bitte aktualisiere die Liste.",
  reviewChangedOrWorkshopHidden:
    "Die Bewertung wurde geändert oder die Werkstatt ist ausgeblendet. Bitte aktualisiere die Liste.",
  priorEvidenceMissing:
    "Der bisherige Beleg ist nicht verfügbar. Bitte lade ihn erneut hoch.",
  visitEvidenceMissing:
    "Der Besuchsbeleg fehlt. Fordere einen neuen Nachweis an.",
  reviewContentInvalid:
    "Bitte wähle 1–5 Sterne. Der optionale Text darf höchstens 2000 Zeichen enthalten.",
  legacyReviewIncomplete:
    "Diese ältere Einreichung enthält noch keine vollständige Bewertung. Sie muss zuerst ergänzt werden.",
  moderatorNoteRequired:
    "Bitte ergänze einen Prüfvermerk mit mindestens 10 Zeichen.",
  combinedReviewRequired:
    "Bitte reiche Bewertung und Nachweis gemeinsam ein. Nur die Verwaltung kann veröffentlichen.",
  passengerCarOnlyPrefix: "Riparim veröffentlicht Pkw-Werkstätten. ",
  saveDraftSuffix: " Bitte als Entwurf speichern.",
  pocketbasePublicKeyUnsupported:
    "PocketBase benötigt keinen öffentlichen Schlüssel.",
  supabasePublicKeyRequired:
    "Bitte nutze den öffentlichen Publishable-Key oder den bisherigen Anon-Key.",
  businessProfileInvalid: "Bitte prüfe die Profilangaben.",
  businessDocumentsInvalid: "Bitte prüfe die Dokumente.",
  businessUploadCancelled:
    "Der Upload wurde inzwischen abgebrochen. Bitte versuche es erneut.",
  businessClaimUnavailable:
    "Das Profil ist nicht verfügbar, bereits zugeordnet oder dein Antrag wird schon geprüft.",
  businessOwnershipRequired: "Dieses Profil ist deinem Konto nicht zugeordnet.",
  businessDraftExists:
    "Für dieses Profil liegt bereits ein Entwurf vor oder die Zuordnung wurde geändert.",
  businessClaimApprovalConflict:
    "Der Antrag wurde geändert oder du bist nicht mehr zur Freigabe berechtigt.",
  businessClaimConflict:
    "Das Profil ist bereits zugeordnet, das Konto ist gesperrt oder der Antrag wurde geändert.",
  businessDraftChanged: "Der Entwurf wurde bereits geändert.",
  businessDraftDecided: "Der Entwurf wurde bereits entschieden.",
  businessApprovedProfileChanged:
    "Die freigegebenen Angaben wurden inzwischen geändert. Bitte lehne diesen Entwurf ab und fordere einen neuen an.",
  businessGoogleRequired:
    "Für diese Kontaktdaten fehlt eine eindeutige bestätigte Google-Zuordnung. Der bisherige öffentliche Stand bleibt erhalten.",
  businessOwnershipChanged:
    "Die Zuordnung, das Profil oder deine Berechtigung wurde inzwischen geändert.",
  invalidSubmission: "Ungültige Einreichung.",
  accountUnavailable:
    "Die Kontoverwaltung ist gerade nicht verfügbar. Bitte versuche es erneut.",
  invalidAccountPatch: "Nur der Anzeigename kann hier geändert werden.",
  currentPasswordRequired: "Bitte gib dein aktuelles Passwort ein.",
  passwordProofFailed: "Das Passwort konnte nicht bestätigt werden.",
  deletionConfirmationRequired:
    "Bitte bestätige die Kontolöschung ausdrücklich.",
  reauthenticationRequired: "Bitte bestätige deine Identität erneut.",
  deletionIncomplete:
    "Die Löschung konnte nicht abgeschlossen werden. Dein Konto bleibt nach Beginn gesperrt. Bitte wiederhole die Löschung hier; falls nötig hilft die Verwaltung.",
  authProjectChange:
    "Ein aktives Auth-Projekt kann nicht ohne kontrollierte Kontoübernahme gewechselt werden.",
  invalidLocale: "Ungültige Sprache.",
  googleUnavailable: "Google-Anmeldung ist gerade nicht verfügbar.",
  invalidEmail: "Bitte gib eine gültige E-Mail-Adresse ein.",
  invalidPassword: "Bitte nutze ein Passwort mit 12 bis 128 Zeichen.",
  loginFailed:
    "Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort und bestätige deine E-Mail-Adresse.",
  invalidName: "Bitte gib einen Namen mit 2 bis 80 Zeichen ein.",
  recoveryFailed:
    "Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut.",
  passwordUpdateFailed:
    "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.",
  notificationRetryForbidden:
    "Wiederholung derzeit nicht möglich: Wartezeit, Versuchslimit, laufender Versand oder abgeschlossene Nachricht.",
  notificationStartFailed:
    "Die Versandprüfung konnte nicht gestartet werden. Das Ereignis bleibt gespeichert.",
  reviewsUnavailable: "Bewertungen sind momentan nicht verfügbar.",
  invalidUserId: "Ungültige Benutzerkennung.",
  userProtected:
    "Dein eigener und der ursprüngliche Verwaltungszugang sind geschützt: Rolle, Kontostatus und E-Mail-Adresse können nicht geändert werden.",
  userEmailReserved: "Diese E-Mail-Adresse ist für die Verwaltung reserviert.",
  userDeletionStarted:
    "Die Löschung dieses Kontos wurde bereits begonnen. Bitte schließe sie über Löschen ab.",
  roleChangeForbidden:
    "Die Rollenänderung ist nicht mehr erlaubt. Bitte aktualisiere die Benutzerverwaltung und melde dich bei Bedarf erneut an.",
  userDeleteProtected: "Das Administratorkonto kann nicht gelöscht werden.",
  userDeleteIncomplete:
    "Der Benutzer konnte nicht vollständig gelöscht werden. Eine begonnene Löschung hält das Konto gesperrt. Bitte versuche es erneut.",
  reviewUnavailable:
    "Die Bewertung konnte gerade nicht verarbeitet werden. Deine Eingaben bleiben erhalten.",
  fileTooLarge: "Die Datei ist zu groß. Maximal 5 MB.",
  consentRequired: "Bitte bestätige die Checkbox zur privaten Prüfung.",
  evidenceRequired:
    "Bitte lade einen Beleg hoch oder beschreibe einen anderen nachvollziehbaren Nachweis mit mindestens 40 Zeichen.",
  workshopInvalidId: "Ungültige Profilkennung.",
  workshopConflict:
    "Das Profil wurde zwischenzeitlich geändert. Lade die Liste neu und prüfe deine Änderungen.",
  workshopGoogleRequired:
    "Für dieses Profil fehlt eine eindeutige bestätigte Google-Zuordnung oder der Google-Eintrag gehört bereits zu einem anderen Profil. Bitte als Entwurf speichern und die Zuordnung prüfen.",
  workshopRetired:
    "Diese Werkstattkennung wurde entfernt und darf nicht erneut verwendet werden.",
  workshopSourcesInvalid: "Bitte ergänze gültige Quellen.",
  workshopSourcesHttps: "Quellen müssen HTTPS-Links ohne Zugangsdaten sein.",
  workshopInvalidProfile:
    "Bitte prüfe Name, Ort, Adresse, Telefonnummer, Marke, Leistungen, Beschreibung und Prüfdatum.",
  workshopWhatsappInvalid:
    "Bitte ergänze WhatsApp als internationale Telefonnummer oder lasse das Feld leer.",
  workshopSourcesRequired:
    "Ein veröffentlichtes Profil braucht mindestens eine nachvollziehbare Quelle.",
  workshopCoordinatesInvalid:
    "Bitte ergänze gültige Koordinaten in Kosovo oder lasse beide Felder leer.",
  accountFieldsSeparate:
    "Bitte ändere Rolle und Kontostatus getrennt von den Benutzerdaten.",
  accountStatusInvalid: "Bitte wähle einen gültigen Kontostatus.",
  accountRoleInvalid: "Bitte wähle die Rolle Benutzer oder Admin.",
  userPasswordWeak: "Bitte wähle ein stärkeres Passwort.",
  usersUnavailable:
    "Die Benutzerverwaltung ist gerade nicht verfügbar. Bitte versuche es erneut.",
  usersConfigurationMissing:
    "Für die Benutzerverwaltung muss der passend gebundene Auth-Adminschlüssel in der Serverkonfiguration hinterlegt sein.",
  authConfigInvalid: "Bitte wähle einen unterstützten Auth-Anbieter.",
  authProjectUrl:
    "Bitte nutze die HTTPS-Adresse des gewählten Anbieters mit passender serverseitiger Freigabe.",
  authProviderConnection:
    "Die Verbindung konnte nicht bestätigt werden. Prüfe Anbieter, Adresse und öffentliche Einstellungen.",
  authEmailConfirmation:
    "Aktiviere E-Mail-Anmeldung, Registrierung und E-Mail-Bestätigung. Automatische Bestätigung muss ausgeschaltet sein.",
  authProviderRequired:
    "Aktiviere E-Mail mit E-Mail-Bestätigung oder verbinde Google im Auth-Projekt.",
  businessInvalidInput: "Bitte prüfe deine Eingaben und den Inhabernachweis.",
  businessUnavailable:
    "Der Betriebsbereich ist gerade nicht verfügbar. Deine Eingaben bleiben erhalten.",
} as const;
