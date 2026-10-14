import { cookies, headers } from "next/headers";
import { storage } from "@/db/storage";
import type { AppUser } from "@/app/auth";
import {
  resolveProviderAccount,
  configuredIdentity,
} from "@/lib/auth/identities";

import {
  accountDeletionCookie as cookieName,
  deletionTokenHash as digest,
  deletionProtected,
  readDeletionGrantToken,
  type DeletionGrant,
} from "./deletion-read";
export { matchesDeletionGrant, deletionProtected } from "./deletion-read";
export type { DeletionGrant } from "./deletion-read";
const retrySeconds = 7 * 86400;
async function setCookie(token: string, maxAge: number) {
  const host = (await headers()).get("host") ?? "";
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host),
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}
export async function issueDeletionGrant(
  user: AppUser,
  config: { provider: string; projectUrl: string },
  id: string,
) {
  if (
    user.userId !== (await resolveProviderAccount(config, id)) ||
    (await deletionProtected(user))
  )
    throw Error("DELETION_FORBIDDEN");
  const token = crypto.randomUUID() + crypto.randomUUID(),
    hash = await digest(token),
    db = storage().db;
  await db
    .prepare("DELETE FROM auth_account_deletions WHERE expires_at<?")
    .bind(Date.now())
    .run();
  const row = await db
    .prepare(
      "INSERT INTO auth_account_deletions (account_id,user_id,token_hash,expires_at,started,identity_issuer,identity_provider) VALUES (?,?,?,?,0,?,?) ON CONFLICT(account_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,user_id=excluded.user_id,identity_issuer=excluded.identity_issuer,identity_provider=excluded.identity_provider WHERE auth_account_deletions.started=0 RETURNING account_id",
    )
    .bind(
      user.userId,
      id,
      hash,
      Date.now() + 600000,
      configuredIdentity(config, id).issuer,
      config.provider,
    )
    .first();
  if (!row) throw Error("DELETION_STARTED");
  await setCookie(token, retrySeconds);
}
export async function readDeletionGrant() {
  return readDeletionGrantToken((await cookies()).get(cookieName)?.value);
}
export async function startDeletion(grant: DeletionGrant) {
  const db = storage().db;
  // Role checks and the access block share one transaction. A concurrent
  // promotion cannot turn an administrator into an unprotected self-deletion.
  const permitted =
    "EXISTS (SELECT 1 FROM auth_account_deletions WHERE token_hash=? AND expires_at>?) AND NOT EXISTS (SELECT 1 FROM auth_account_roles WHERE account_id=? AND role='admin') AND NOT EXISTS (SELECT 1 FROM auth_links WHERE account_id=? AND owner_admin=1)";
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO auth_account_status (account_id,status,updated_at) SELECT ?,'deleted',? WHERE ${permitted} ON CONFLICT(account_id) DO UPDATE SET status='deleted',updated_at=excluded.updated_at`,
      )
      .bind(
        grant.account_id,
        new Date().toISOString(),
        grant.token_hash,
        Date.now(),
        grant.account_id,
        grant.account_id,
      ),
    db
      .prepare(
        "UPDATE auth_sessions SET revoked=1 WHERE account_id=? AND EXISTS (SELECT 1 FROM auth_account_status WHERE account_id=? AND status='deleted')",
      )
      .bind(grant.account_id, grant.account_id),
    db
      .prepare(
        "UPDATE auth_account_deletions SET started=1,expires_at=? WHERE token_hash=? AND EXISTS (SELECT 1 FROM auth_account_status WHERE account_id=? AND status='deleted')",
      )
      .bind(
        Date.now() + retrySeconds * 1000,
        grant.token_hash,
        grant.account_id,
      ),
  ]);
  if (!results[0].meta.changes) throw Error("DELETION_FORBIDDEN");
}
export async function clearDeletionGrant(grant: DeletionGrant) {
  await storage()
    .db.prepare("DELETE FROM auth_account_deletions WHERE account_id=?")
    .bind(grant.account_id)
    .run();
  await setCookie("", 0);
}
