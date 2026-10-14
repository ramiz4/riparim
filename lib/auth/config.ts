import { ValidationError } from "@/lib/validation-error";
import { validatedReturnPath } from "@/lib/auth/return-path";
import { env } from "@/lib/runtime/env";
import { storage } from "@/db/storage";
import { trustedAuthOrigin } from "./origin";
import { authAvailability, validateSupabaseKey } from "./provider";
export type AuthProvider = "supabase" | "pocketbase";
export type AuthConfig = {
  provider: AuthProvider;
  projectUrl: string;
  publicKey: string;
  enabled: boolean;
  emailDeliveryConfirmed: boolean;
  updatedAt: string;
};
export async function getAuthConfig(): Promise<AuthConfig | null> {
  const db = storage().db;
  let row = await db
    .prepare("SELECT * FROM auth_settings WHERE id='main'")
    .first<Record<string, unknown>>();
  const requestedAt = env.EMAIL_LOGIN_ACTIVATION_TIME,
    requestedProject = env.EMAIL_LOGIN_ACTIVATION_PROJECT;
  // Apply an authorized configuration change once. A later owner edit always wins.
  if (
    row &&
    (row.provider ?? "supabase") === "supabase" &&
    row.enabled === 0 &&
    requestedProject === row.project_url &&
    requestedAt &&
    Number.isFinite(Date.parse(requestedAt)) &&
    Date.parse(requestedAt) <= Date.now() &&
    Date.parse(String(row.updated_at)) < Date.parse(requestedAt)
  ) {
    try {
      await verifyProvider(
        {
          provider: "supabase",
          projectUrl: String(row.project_url),
          publicKey: String(row.public_key),
        },
        false,
      );
      await db
        .prepare(
          "UPDATE auth_settings SET enabled=1,updated_at=? WHERE id='main' AND provider='supabase' AND project_url=? AND public_key=? AND enabled=0 AND updated_at=?",
        )
        .bind(requestedAt, row.project_url, row.public_key, row.updated_at)
        .run();
      row = await db
        .prepare("SELECT * FROM auth_settings WHERE id='main'")
        .first<Record<string, unknown>>();
    } catch {
      /* Keep the saved settings when provider verification is unavailable. */
    }
  }
  if (!row) return null;
  let config;
  try {
    config = validatePublicConfig(
      String(row.project_url),
      String(row.public_key),
      row.provider ?? "supabase",
    );
  } catch {
    return null;
  }
  return {
    ...config,
    enabled: row.enabled === 1,
    emailDeliveryConfirmed: row.email_delivery_confirmed === 1,
    updatedAt: String(row.updated_at),
  };
}
export function siteOrigin() {
  return env.SITE_ORIGIN || "https://riparim.com";
}
export function safeReturnPath(value: unknown, fallback = "/?besuche=1") {
  return validatedReturnPath(value, siteOrigin(), fallback);
}
export function validatePublicConfig(
  url: string,
  key: string,
  provider: unknown = "supabase",
): Pick<AuthConfig, "provider" | "projectUrl" | "publicKey"> {
  if (provider !== "supabase" && provider !== "pocketbase")
    throw new ValidationError(
      "auth_config_invalid",
      "Bitte wähle einen unterstützten Auth-Anbieter.",
    );
  let origin: string;
  try {
    origin = trustedAuthOrigin(url, provider);
  } catch {
    throw new ValidationError(
      "auth_project_url",
      "Bitte nutze die HTTPS-Adresse des gewählten Anbieters mit passender serverseitiger Freigabe.",
    );
  }
  if (provider === "pocketbase") {
    if (key)
      throw new ValidationError(
        "auth_public_key",
        "PocketBase benötigt keinen öffentlichen Schlüssel.",
      );
    return { provider, projectUrl: origin, publicKey: "" };
  }
  try {
    validateSupabaseKey(key);
  } catch {
    throw new ValidationError(
      "auth_public_key",
      "Bitte nutze den öffentlichen Publishable-Key oder den bisherigen Anon-Key.",
    );
  }
  return { provider, projectUrl: origin, publicKey: key };
}
export async function providerAvailability(config: AuthConfig | null) {
  const unavailable = {
    email: false,
    emailSignup: false,
    emailRecovery: false,
    google: false,
  };
  if (!config?.enabled) return unavailable;
  try {
    const ready = await authAvailability(config);
    return {
      ...ready,
      emailRecovery: ready.emailRecovery && config.emailDeliveryConfirmed,
    };
  } catch {
    return unavailable;
  }
}
export async function verifyProvider(
  config: Pick<AuthConfig, "provider" | "projectUrl" | "publicKey">,
  emailDeliveryConfirmed = true,
) {
  let ready;
  try {
    ready = await authAvailability(config);
  } catch {
    throw new ValidationError(
      "auth_provider_connection",
      "Die Verbindung konnte nicht bestätigt werden. Prüfe Anbieter, Adresse und öffentliche Einstellungen.",
    );
  }
  if (
    emailDeliveryConfirmed &&
    (!ready.email || !ready.emailSignup || !ready.emailRecovery)
  )
    throw new ValidationError(
      "auth_email_confirmation",
      "Aktiviere E-Mail-Anmeldung, Registrierung und E-Mail-Bestätigung. Automatische Bestätigung muss ausgeschaltet sein.",
    );
  if (!ready.email && !ready.google)
    throw new ValidationError(
      "auth_provider_required",
      "Aktiviere E-Mail mit E-Mail-Bestätigung oder verbinde Google im Auth-Projekt.",
    );
}
