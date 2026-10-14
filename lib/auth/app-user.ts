import { publicAccountName } from "@/lib/account-name";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import type { AuthClient } from "./contract";
import type { AuthConfig } from "./config";
import {
  allowsLegacyAccess,
  allowsGoogleModeration,
  googleIdentityMatches,
  type LegacyLink,
  type SessionGrant,
} from "./policy";
import { storage, moderatorEmail } from "@/db/storage";
import { legacySessionId } from "./legacy-supabase";
import {
  resolveAccount,
  sessionIdentityMatches,
  type AccountIdentity,
} from "./identities";
import { accountBlocked, providerBlocked } from "./account-status";

export type AppUser = ChatGPTUser & {
  provider: string;
  ownerKeys: string[];
  isModerator: boolean;
};
export function legacyAppUser(u: ChatGPTUser): AppUser {
  return {
    ...u,
    provider: "ChatGPT",
    ownerKeys: [u.userId],
    isModerator: u.email.toLowerCase() === moderatorEmail(),
  };
}
export function appSessionId(identity: AccountIdentity, id: string) {
  return JSON.stringify([identity.provider, identity.issuer, id]);
}

export async function resolveAppUser(
  c: AuthConfig | null,
  client: AuthClient | null,
  native: ChatGPTUser | null = null,
): Promise<AppUser | null> {
  if (!c?.enabled)
    return native && !(await accountBlocked(native.userId))
      ? legacyAppUser(native)
      : null;
  if (!client) return null;
  const {
    data: { user },
    error,
  } = await client.getUser();
  if (
    error ||
    !user?.email ||
    !user.emailVerified ||
    user.identity.provider !== c.provider ||
    user.identity.issuer !== c.projectUrl
  )
    return null;
  if (providerBlocked(user)) return null;
  const id = await resolveAccount(user.identity);
  if (await accountBlocked(id)) return null;
  const proof = await client.getSessionProof(),
    sessionId = proof.data.proof?.id;
  if (
    proof.error ||
    proof.data.proof?.subject !== user.identity.subject ||
    typeof sessionId !== "string"
  )
    return null;
  const link = await storage()
    .db.prepare(
      "SELECT legacy_owner,password_access FROM auth_links WHERE account_id=?",
    )
    .bind(id)
    .first<LegacyLink>();
  // Read the session and role together: promotion must never upgrade an old
  // customer session that the same role-change transaction has just revoked.
  const session = await storage()
    .db.prepare(
      "SELECT s.legacy_access,s.provider,s.google_subject,s.moderator,s.identity_provider,s.identity_issuer,s.identity_subject,r.role AS account_role FROM auth_sessions s LEFT JOIN auth_account_roles r ON r.account_id=s.account_id WHERE s.id IN (?,?) AND s.account_id=? AND s.revoked=0 AND s.expires_at>? ORDER BY (s.id=?) DESC LIMIT 1",
    )
    .bind(
      appSessionId(user.identity, sessionId),
      legacySessionId(user.identity, sessionId) ??
        appSessionId(user.identity, sessionId),
      id,
      Date.now(),
      appSessionId(user.identity, sessionId),
    )
    .first<
      SessionGrant & {
        account_role: string | null;
        identity_provider: string | null;
        identity_issuer: string | null;
        identity_subject: string | null;
      }
    >();
  if (
    !session ||
    !["password", "google"].includes(session.provider) ||
    !sessionIdentityMatches(session, user.identity, id)
  )
    return null;
  if (
    session.provider === "google" &&
    (!googleIdentityMatches(user, session.google_subject) ||
      (proof.data.proof?.method !== null &&
        proof.data.proof?.method !== "google"))
  )
    return null;
  const fullName = user.name ?? null;
  return {
    userId: id,
    email: user.email,
    fullName,
    displayName: publicAccountName(fullName),
    provider: session.provider === "google" ? "Google" : "E-Mail",
    ownerKeys: allowsLegacyAccess(session, link)
      ? [id, link!.legacy_owner]
      : [id],
    isModerator:
      allowsGoogleModeration(user, session, moderatorEmail()) ||
      session.account_role === "admin",
  };
}

export function ownerPair(user: AppUser): [string, string] {
  return [user.ownerKeys[0], user.ownerKeys[1] ?? user.ownerKeys[0]];
}
export function ownsVisit(user: AppUser, owner: string) {
  return user.ownerKeys.includes(owner);
}
