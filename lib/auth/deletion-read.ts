import { storage } from "@/db/storage";
import type { AppUser } from "./app-user";
import {
  resolveProviderAccount,
  configuredIdentity,
  legacyIdentityMatches,
} from "./identities";
import { isBootstrapAccount, hasAdminRole } from "./roles";

export const accountDeletionCookie = "riparim-account-deletion";
export type DeletionGrant = {
  account_id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  started: number;
  identity_issuer: string | null;
  identity_provider: string;
};
export async function matchesDeletionGrant(
  grant: DeletionGrant,
  config: { provider: string; projectUrl: string },
) {
  const identity = configuredIdentity(config, grant.user_id);
  if (grant.identity_provider !== identity.provider) return false;
  if (grant.identity_issuer === null)
    return legacyIdentityMatches(grant.account_id, identity);
  return (
    grant.identity_issuer === identity.issuer &&
    grant.account_id === (await resolveProviderAccount(config, grant.user_id))
  );
}
export async function deletionTokenHash(token: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function deletionProtected(user: AppUser) {
  if (
    user.isModerator ||
    isBootstrapAccount(user.email) ||
    (await hasAdminRole(user.userId))
  )
    return true;
  return !!(await storage()
    .db.prepare(
      "SELECT account_id FROM auth_links WHERE account_id=? AND owner_admin=1",
    )
    .bind(user.userId)
    .first());
}
export async function readDeletionGrantToken(token?: string) {
  if (!token || !/^[0-9a-f-]{72}$/.test(token)) return null;
  return storage()
    .db.prepare(
      "SELECT * FROM auth_account_deletions WHERE token_hash=? AND expires_at>?",
    )
    .bind(await deletionTokenHash(token), Date.now())
    .first<DeletionGrant>();
}
