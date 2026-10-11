// Only fields and operations consumed by Riparim. SDK types stay in provider.ts.
export type AuthUser={
 id:string;email?:string;email_confirmed_at?:string;created_at?:string;last_sign_in_at?:string;banned_until?:string;
 user_metadata:Record<string,unknown>;
 identities?:{provider:string;identity_data?:Record<string,unknown>}[];
};
export type AuthSession={access_token:string;refresh_token:string;provider_token?:string|null;user:AuthUser};
export type AuthError={message?:string;code?:string;status?:number};
type Result<T>={data:T;error:AuthError|null};
type SessionResult=Result<{user:AuthUser|null;session:AuthSession|null}>;
export type AuthUserAttributes={email?:string;password?:string;user_metadata?:Record<string,unknown>;email_confirm?:boolean;ban_duration?:string};
export type AuthClient={auth:{
 getUser():Promise<Result<{user:AuthUser|null}>>;
 getClaims():Promise<Result<{claims:{sub?:string;session_id?:unknown;amr?:(string|{method?:unknown})[]}}|null>>;
 signInWithPassword(credentials:{email:string;password:string}):Promise<SessionResult>;
 signUp(credentials:{email:string;password:string;options:{data:Record<string,unknown>;emailRedirectTo:string}}):Promise<SessionResult>;
 signInWithOAuth(credentials:{provider:'google';options:{redirectTo:string;scopes:string;skipBrowserRedirect:boolean;queryParams:{prompt:string}}}):Promise<Result<{url:string|null}>>;
 exchangeCodeForSession(code:string):Promise<SessionResult>;
 verifyOtp(params:{token_hash:string;type:'signup'|'recovery'}):Promise<SessionResult>;
 setSession(tokens:{access_token:string;refresh_token:string}):Promise<SessionResult>;
 resetPasswordForEmail(email:string,options:{redirectTo:string}):Promise<{error:AuthError|null}>;
 updateUser(attributes:{password:string}):Promise<Result<{user:AuthUser|null}>>;
 signOut(options:{scope:'local'|'global'}):Promise<{error:AuthError|null}>;
}};
export type AuthAdminClient={auth:{admin:{
 listUsers(params:{page:number;perPage:number}):Promise<Result<{users:AuthUser[];total?:number}>>;
 getUserById(id:string):Promise<Result<{user:AuthUser|null}>>;
 createUser(attributes:AuthUserAttributes):Promise<Result<{user:AuthUser|null}>>;
 updateUserById(id:string,attributes:AuthUserAttributes):Promise<Result<{user:AuthUser|null}>>;
 deleteUser(id:string):Promise<Result<{user:AuthUser|null}>>;
}}};
export type AuthCookieOptions={httpOnly?:boolean;secure?:boolean;sameSite?:'lax'|'strict'|'none'|boolean;path?:string;domain?:string;maxAge?:number;expires?:Date};
export type AuthCookies={getAll():{name:string;value:string}[];setAll(values:{name:string;value:string;options:AuthCookieOptions}[]):void};
