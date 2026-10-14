import type { AuthUser as User } from "@/lib/auth/contract";

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: true;
};
export type SessionGrant = {
  provider: string;
  google_subject: string | null;
  moderator: number;
  legacy_access: number;
};
export type LegacyLink = { legacy_owner: string; password_access: number };
const normalized = (email: string) => email.trim().toLowerCase();

export function googleIdentityMatches(
  user: User,
  subject: string | null,
  email = user.email,
): boolean {
  if (
    !subject ||
    !email ||
    !user.emailVerified ||
    !user.email ||
    normalized(email) !== normalized(user.email)
  )
    return false;
  return !!user.googleIdentities.some(
    (identity) =>
      identity.subject === subject &&
      identity.emailVerified &&
      normalized(identity.email) === normalized(email),
  );
}

export function verifiedGoogleProfile(
  user: User,
  profile: unknown,
): GoogleProfile {
  if (!profile || typeof profile !== "object")
    throw Error("INVALID_GOOGLE_IDENTITY");
  const value = profile as Record<string, unknown>;
  if (
    typeof value.sub !== "string" ||
    !value.sub ||
    typeof value.email !== "string" ||
    value.email_verified !== true ||
    !googleIdentityMatches(user, value.sub, value.email)
  )
    throw Error("INVALID_GOOGLE_IDENTITY");
  return { sub: value.sub, email: value.email, email_verified: true };
}

export function allowsLegacyAccess(
  session: SessionGrant,
  link: LegacyLink | null,
) {
  return (
    !!link &&
    session.legacy_access === 1 &&
    (session.provider === "google" ||
      (session.provider === "password" && link.password_access === 1))
  );
}

export function allowsGoogleModeration(
  user: User,
  session: SessionGrant,
  ownerEmail: string,
) {
  return (
    !!ownerEmail &&
    session.provider === "google" &&
    session.moderator === 1 &&
    googleIdentityMatches(user, session.google_subject, ownerEmail)
  );
}
