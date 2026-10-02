import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const visits = sqliteTable("visits", {
 id:text("id").primaryKey(),owner:text("owner").notNull(),workshop:text("workshop").notNull(),date:text("date").notNull(),vehicle:text("vehicle").notNull(),service:text("service").notNull(),
 evidenceType:text("evidence_type").notNull(),evidenceNote:text("evidence_note").notNull().default(""),fileKey:text("file_key"),fileName:text("file_name"),fileType:text("file_type"),
 status:text("status").notNull().default("pending"),moderatorNote:text("moderator_note").notNull().default(""),moderatedAt:text("moderated_at"),
 displayName:text("display_name"),rating:integer("rating"),review:text("review"),createdAt:text("created_at").notNull()
},table=>[index("idx_visits_owner").on(table.owner),index("idx_visits_workshop_status").on(table.workshop,table.status)]);
