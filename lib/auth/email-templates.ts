// Auth requests always supply a canonical callback URL with a `weiter` query.
// Append the token to that URL so confirmation preserves the customer's page.
export const confirmationEmailTemplate='<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=signup">E-Mail-Adresse bestätigen</a>';
export const recoveryEmailTemplate='<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Passwort zurücksetzen</a>';
