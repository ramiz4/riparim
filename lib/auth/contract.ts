import type { AccountIdentity } from "./identities";

// Provider payloads, token formats and cookie names are private to the adapters.
export type AuthUser = {
  identity: AccountIdentity;
  email?: string;
  emailVerified: boolean;
  name?: string;
  preferredLocale?: string;
  createdAt?: string;
  lastSignInAt?: string;
  blocked: boolean;
  loginProviders: string[];
  googleIdentities: {
    subject: string;
    email: string;
    emailVerified: boolean;
  }[];
};
export type AuthMethod = "password" | "google" | "recovery";
export type SessionProof = {
  id: string;
  subject: string;
  method: AuthMethod | "unknown" | null;
};
export type AuthSession = { user: AuthUser; googleAccessToken?: string | null };
export type AuthError = {
  code:
    | "invalid_credentials"
    | "not_found"
    | "email_exists"
    | "weak_password"
    | "rate_limited"
    | "email_unavailable"
    | "unavailable"
    | "invalid_response";
  status?: number;
};
export type AuthResult<T> = { data: T; error: AuthError | null };
export type SessionResult = AuthResult<{
  user: AuthUser | null;
  session: AuthSession | null;
}>;
export type AuthAvailability = {
  email: boolean;
  emailSignup: boolean;
  emailRecovery: boolean;
  google: boolean;
};
export type AuthUserAttributes = {
  email?: string;
  password?: string;
  name?: string;
  preferredLocale?: string;
  emailVerified?: boolean;
  active?: boolean;
};
export type AuthClient = {
  getUser(): Promise<AuthResult<{ user: AuthUser | null }>>;
  getSessionProof(): Promise<AuthResult<{ proof: SessionProof | null }>>;
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<SessionResult>;
  signUp(credentials: {
    email: string;
    password: string;
    name: string;
    preferredLocale: string;
    redirectTo: string;
  }): Promise<SessionResult>;
  beginGoogle(redirectTo: string): Promise<AuthResult<{ url: string | null }>>;
  completeGoogle(code: string, state?: string | null): Promise<SessionResult>;
  confirmEmail(
    token: string,
    format?: "token" | "code",
  ): Promise<AuthResult<{ confirmed: boolean }>>;
  acceptRecovery(
    token: string,
    format?: "token" | "code",
  ): Promise<AuthResult<{ ready: boolean }>>;
  callbackReturn(type: "signup" | "recovery" | "google"): string | null;
  recoveryReady(): Promise<boolean>;
  requestRecovery(
    email: string,
    redirectTo: string,
  ): Promise<{ error: AuthError | null }>;
  resetPassword(
    password: string,
  ): Promise<AuthResult<{ identity: AccountIdentity | null }>>;
  signOut(options: {
    scope: "local" | "global";
  }): Promise<{ error: AuthError | null }>;
};
export type AuthAdminClient = {
  listUsers(params: {
    page: number;
    perPage: number;
  }): Promise<AuthResult<{ users: AuthUser[]; total?: number }>>;
  getUserById(id: string): Promise<AuthResult<{ user: AuthUser | null }>>;
  createUser(
    attributes: AuthUserAttributes,
  ): Promise<AuthResult<{ user: AuthUser | null }>>;
  updateUserById(
    id: string,
    attributes: AuthUserAttributes,
  ): Promise<AuthResult<{ user: AuthUser | null }>>;
  deleteUser(id: string): Promise<AuthResult<{ user: AuthUser | null }>>;
};
export type AuthCookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
};
export type AuthCookies = {
  getAll(): { name: string; value: string }[];
  setAll(
    values: { name: string; value: string; options: AuthCookieOptions }[],
  ): void;
};
