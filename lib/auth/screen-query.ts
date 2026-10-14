// Browser query keys and values are an existing public compatibility contract.
// Auth components consume English names after this request-boundary adapter.
export type AuthScreenQuery = {
  returnTo?: string;
  error?: "confirmation" | "google";
  notice?: "email-confirmed" | "password-changed";
};
export type AuthScreenSearchParams = Record<
  string,
  string | string[] | undefined
>;
export function parseAuthScreenQuery(
  source: AuthScreenSearchParams | URLSearchParams,
): AuthScreenQuery {
  function single(key: string): string | undefined {
    const value =
      source instanceof URLSearchParams ? source.getAll(key) : source[key];
    return typeof value === "string"
      ? value
      : value?.length === 1
        ? value[0]
        : undefined;
  }
  const error = single("fehler"),
    notice = single("hinweis");
  return {
    returnTo: single("weiter"),
    error:
      error === "bestaetigung"
        ? "confirmation"
        : error === "google"
          ? "google"
          : undefined,
    notice:
      notice === "email-bestaetigt"
        ? "email-confirmed"
        : notice === "passwort-geaendert"
          ? "password-changed"
          : undefined,
  };
}
