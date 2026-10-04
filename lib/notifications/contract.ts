export type ReviewDecision="published"|"needs_more";
export type NotificationState="pending"|"sending"|"sent"|"blocked"|"failed"|"unknown"|"suppressed";
export type NotificationRow={
 id:string;visit_id:string;owner:string;revision:number;decision:ReviewDecision;operation_token:string;
 state:NotificationState;attempts:number;next_attempt_at:number;created_at:string;lease_until:number|null;lease_token:string|null;
 first_attempt_at:number|null;payload:string|null;provider_key_hash:string|null;provider_id:string|null;last_error:string|null;
};
export type NotificationView={id:string;visitId:string;workshopName:string;decision:ReviewDecision;state:NotificationState;attempts:number;nextAttemptAt:number;createdAt:string;error:string|null;retryable:boolean};
export const notificationStateLabels:Record<NotificationState,string>={pending:"Versand vorgemerkt",sending:"Versand wird geprüft",sent:"An Versanddienst übergeben",blocked:"Versand blockiert",failed:"Versand fehlgeschlagen",unknown:"Versandstatus unklar",suppressed:"Benachrichtigung entfällt"};
export const notificationErrorLabels:Record<string,string>={
 configuration_missing:"Der serverseitige E-Mail-Versand ist noch nicht eingerichtet.",auth_configuration_missing:"Der Zugriff auf bestätigte Kontoadressen ist nicht eingerichtet.",
 no_verified_contact:"Für diese Einreichung ist keine bestätigte Kontaktadresse verfügbar.",account_blocked:"Das zugehörige Konto ist gesperrt oder wird gelöscht.",superseded:"Die Einreichung wurde inzwischen geändert oder gelöscht.",
 recipient_changed:"Die bestätigte Kontoadresse hat sich seit dem ersten Versandversuch geändert.",credential_changed:"Die Versandverbindung hat sich seit dem ersten Versuch geändert; prüfe den bisherigen Versand beim Dienst.",
 provider_unavailable:"Der Versanddienst ist vorübergehend nicht erreichbar.",rate_limited:"Der Versanddienst begrenzt weitere Nachrichten vorübergehend.",provider_rejected:"Der Versanddienst hat die Nachricht abgewiesen. Prüfe die Absender- und Serverkonfiguration.",
 retry_limit:"Die automatischen Versuche sind ausgeschöpft. Eine kontrollierte Wiederholung ist noch möglich.",idempotency_window_expired:"Der sichere Wiederholungszeitraum ist abgelaufen. Prüfe die Nachricht beim Versanddienst, bevor du weitere Maßnahmen ergreifst.",invalid_payload:"Die gespeicherte Nachricht konnte nicht sicher geprüft werden."
};
