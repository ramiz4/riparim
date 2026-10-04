import { integer, real, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const visits = sqliteTable("visits", {
 id:text("id").primaryKey(),owner:text("owner").notNull(),workshop:text("workshop").notNull(),date:text("date").notNull(),vehicle:text("vehicle").notNull(),service:text("service").notNull(),
 evidenceType:text("evidence_type").notNull(),evidenceNote:text("evidence_note").notNull().default(""),fileKey:text("file_key"),fileName:text("file_name"),fileType:text("file_type"),
 status:text("status").notNull().default("pending"),moderatorNote:text("moderator_note").notNull().default(""),moderatedAt:text("moderated_at"),moderatedBy:text("moderated_by"),revision:integer("revision").notNull().default(0),
 displayName:text("display_name"),rating:integer("rating"),review:text("review"),createdAt:text("created_at").notNull()
},table=>[index("idx_visits_owner").on(table.owner),index("idx_visits_workshop_status").on(table.workshop,table.status)]);
export const workshopProfiles = sqliteTable("workshops", {
 id:text("id").primaryKey(),name:text("name").notNull(),city:text("city").notNull(),address:text("address").notNull(),
 phone:text("phone").notNull(),phoneNote:text("phone_note").notNull().default(""),whatsapp:text("whatsapp").notNull().default(""),
 brands:text("brands").notNull(),services:text("services").notNull(),serviceDetails:text("service_details").notNull().default("[]"),languages:text("languages").notNull().default("[]"),
 specialty:text("specialty").notNull(),description:text("description").notNull(),lat:text("lat"),lng:text("lng"),
 sources:text("sources").notNull(),checkedAt:text("checked_at").notNull(),status:text("status").notNull().default("draft"),updatedAt:text("updated_at").notNull()
},table=>[index("idx_workshops_status_city").on(table.status,table.city)]);
export const catalogState=sqliteTable("catalog_state",{key:text("key").primaryKey(),value:text("value").notNull()});
export const workshopGoogleRatings=sqliteTable("workshop_google_ratings",{
 workshopId:text("workshop_id").primaryKey(),rating:real("rating"),reviewCount:integer("review_count"),mapsUrl:text("maps_url").notNull(),
 sourceUrl:text("source_url"),sourceLabel:text("source_label"),checkedAt:text("checked_at").notNull(),sourceUpdatedAt:text("source_updated_at")
});
export const workshopGooglePlaces=sqliteTable("workshop_google_places",{
 workshopId:text("workshop_id").primaryKey(),placeId:text("place_id"),profileHash:text("profile_hash").notNull(),checkedAt:integer("checked_at").notNull(),retryAfter:integer("retry_after").notNull()
});
export const authSettings=sqliteTable("auth_settings",{id:text("id").primaryKey(),projectUrl:text("project_url").notNull(),publicKey:text("public_key").notNull(),enabled:integer("enabled").notNull().default(0),emailDeliveryConfirmed:integer("email_delivery_confirmed").notNull().default(0),updatedAt:text("updated_at").notNull()});
export const authLinks=sqliteTable("auth_links",{accountId:text("account_id").primaryKey(),legacyOwner:text("legacy_owner").notNull().unique(),ownerAdmin:integer("owner_admin").notNull().default(0),createdAt:text("created_at").notNull(),passwordAccess:integer("password_access").notNull().default(1)});
export const authAttempts=sqliteTable("auth_attempts",{key:text("key").primaryKey(),attempts:integer("attempts").notNull().default(0),expiresAt:integer("expires_at").notNull()},table=>[index("idx_auth_attempts_expiry").on(table.expiresAt)]);
export const authSessions=sqliteTable("auth_sessions",{id:text("id").primaryKey(),accountId:text("account_id").notNull(),revoked:integer("revoked").notNull().default(0),legacyAccess:integer("legacy_access").notNull().default(0),expiresAt:integer("expires_at").notNull(),createdAt:text("created_at").notNull(),provider:text("provider").notNull().default("password"),googleSubject:text("google_subject"),moderator:integer("moderator").notNull().default(0)},table=>[index("idx_auth_sessions_account").on(table.accountId),index("idx_auth_sessions_expiry").on(table.expiresAt)]);
export const authAccountStatus=sqliteTable("auth_account_status",{accountId:text("account_id").primaryKey(),status:text("status").notNull(),updatedAt:text("updated_at").notNull()});
export const authAccountRoles=sqliteTable("auth_account_roles",{accountId:text("account_id").primaryKey(),role:text("role",{enum:["admin"]}).notNull().default("admin"),assignedAt:text("assigned_at").notNull(),assignedBy:text("assigned_by").notNull()});
