// Operator mail retains its established German presentation language.
export const backupStatusLabels = {
  healthy: "Gesund",
  failure: "Sicherung fehlgeschlagen",
  cancelled: "Sicherung abgebrochen",
  timed_out: "Sicherung abgelaufen",
  skipped: "Sicherung übersprungen",
  neutral: "Sicherung ohne Erfolg",
  action_required: "Sicherung benötigt Eingriff",
  stale: "Sicherung veraltet",
  startup_failure: "Sicherung nicht gestartet",
  incomplete: "Sicherung nicht abgeschlossen",
  invalid_artifact: "Gültiges Backup-Artefakt fehlt",
  missing: "Sicherung fehlt",
  disabled: "Workflow deaktiviert",
  stuck: "Sicherung hängt",
  monitor_error: "Prüfung fehlgeschlagen",
  awaiting_backup: "Neue Sicherung ausstehend",
  recovered: "Entwarnung: Sicherung erfolgreich",
};
export function backupNotificationText(message) {
  return `Job: ${message.job}\nStatus: ${backupStatusLabels[message.status]}\nLetzte erfolgreiche Sicherung: ${message.lastSuccessAt ?? "keine verifiziert"}\nLink: ${message.url}`;
}
