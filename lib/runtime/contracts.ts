// Only the SQL and private-object operations used by the application.
export type SqlResult<T=Record<string,unknown>>={results:T[];meta:{changes:number};success:boolean};
export interface SqlStatement {
 bind(...values:unknown[]):SqlStatement;
 first<T=Record<string,unknown>>():Promise<T|null>;
 all<T=Record<string,unknown>>():Promise<SqlResult<T>>;
 run():Promise<SqlResult>;
}
export interface SqlDatabase {
 prepare(sql:string):SqlStatement;
 batch<T=Record<string,unknown>>(statements:SqlStatement[]):Promise<SqlResult<T>[]>;
}
export type PrivateHttpMetadata={contentType?:string;contentLanguage?:string;contentDisposition?:string;contentEncoding?:string;cacheControl?:string;cacheExpiry?:Date};
type ObjectChecksums={md5?:string;sha1?:string;sha256?:string;sha384?:string;sha512?:string};
export type PrivateObject={key:string;etag:string;size:number;uploaded:Date;httpMetadata?:PrivateHttpMetadata;customMetadata?:Record<string,string>;version?:string;storageClass?:string;checksums?:{toJSON():ObjectChecksums}};
export type PrivateObjectBody=PrivateObject&{body:ReadableStream<Uint8Array>;arrayBuffer():Promise<ArrayBuffer>;text():Promise<string>};
export type PutOptions={httpMetadata?:PrivateHttpMetadata;customMetadata?:Record<string,string>;onlyIf?:{etagMatches:string}};
export interface PrivateFiles {
 put(key:string,value:ArrayBuffer|Uint8Array|string|null,options:PutOptions&{onlyIf:{etagMatches:string}}):Promise<PrivateObject|null>;
 put(key:string,value:ArrayBuffer|Uint8Array|string|null,options?:Omit<PutOptions,'onlyIf'>):Promise<PrivateObject>;
 get(key:string,options?:{onlyIf:{etagMatches:string}}):Promise<PrivateObjectBody|null>;
 head(key:string):Promise<PrivateObject|null>;
 delete(keys:string|string[]):Promise<void>;
 list(options?:{prefix?:string;cursor?:string;limit?:number;include?:('httpMetadata'|'customMetadata')[]}):Promise<{objects:PrivateObject[];truncated:boolean;cursor?:string}>;
}
export type RuntimeEnv={
 DB?:SqlDatabase;BUCKET?:PrivateFiles;SITE_ORIGIN?:string;REVIEW_MODERATOR_EMAIL?:string;
 GOOGLE_MAPS_BROWSER_API_KEY?:string;GOOGLE_PLACES_SERVER_API_KEY?:string;
 EMAIL_LOGIN_ACTIVATION_TIME?:string;EMAIL_LOGIN_ACTIVATION_PROJECT?:string;
 AUTH_TRUSTED_ORIGIN?:string;SUPABASE_SECRET_KEY_ORIGIN?:string;SUPABASE_SECRET_KEY?:string;RESEND_API_KEY?:string;TRANSACTIONAL_EMAIL_FROM?:string;
 EMAIL_TRANSPORT?:string;SMTP_URL?:string;SMTP_SECRET_ORIGIN?:string;
 PUBLIC_RELEASE_RENDER?:string;
 MIGRATION_READ_ONLY?:string;MIGRATION_EXPORT_EXPIRES_AT?:string;MIGRATION_EXPORT_TOKEN_SHA256?:string;MIGRATION_SOURCE_COMMIT?:string;
};
