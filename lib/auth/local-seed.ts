export const localSeedAccount = {
  userId: "local_seedy",
  email: "seedy@sites.test",
  displayName: "Seedy",
} as const;
export type LocalSettingsPreview = {
  kind: "admin" | "email" | "google";
  email: string;
  name: string;
  provider: string;
  protected: boolean;
};
export const localEmailPreview: LocalSettingsPreview = {
  kind: "email",
  email: "lea@example.test",
  name: "Lea Beispiel",
  provider: "E-Mail",
  protected: false,
};
export const localGooglePreview: LocalSettingsPreview = {
  kind: "google",
  email: "mira@example.test",
  name: "Mira Beispiel",
  provider: "Google",
  protected: false,
};
