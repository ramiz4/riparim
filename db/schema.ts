import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
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
