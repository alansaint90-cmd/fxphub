import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["super_admin", "admin", "operador", "visualizador"]);
export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageAuthorEnum = pgEnum("message_author", ["lead", "ia", "human", "system"]);
export const leadClassificationEnum = pgEnum("lead_classification", ["A", "B", "C"]);
export const funnelStageEnum = pgEnum("funnel_stage", [
  "novo_lead",
  "ia_atendendo",
  "qualificado",
  "nao_qualificado",
  "agendamento_em_andamento",
  "reuniao_agendada",
]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "rescheduled",
  "cancelled",
  "completed",
  "no_show",
]);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  isDeleted: boolean("is_deleted").notNull().default(false),
  modifiedBy: uuid("modified_by").notNull(),
};

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("operador"),
  ...auditColumns,
});

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    whatsappJid: text("whatsapp_jid").notNull(),
    phone: text("phone").notNull(),
    pushName: text("push_name"),
    drivingSchoolName: text("driving_school_name"),
    city: text("city"),
    monthlyEnrollments: integer("monthly_enrollments"),
    commercialAttendants: integer("commercial_attendants"),
    usesCrm: boolean("uses_crm"),
    runsPaidTraffic: boolean("runs_paid_traffic"),
    score: integer("score").notNull().default(0),
    classification: leadClassificationEnum("classification"),
    painPoints: jsonb("pain_points").$type<string[]>().notNull().default([]),
    qualificationSummary: text("qualification_summary"),
    funnelStage: funnelStageEnum("funnel_stage").notNull().default("novo_lead"),
    currentQualificationQuestion: text("current_qualification_question"),
    qualificationStarted: boolean("qualification_started").notNull().default(false),
    aiPaused: boolean("ai_paused").notNull().default(false),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => ({
    whatsappJidIdx: uniqueIndex("leads_whatsapp_jid_idx").on(table.whatsappJid),
  }),
);

export const qualificationAnswers = pgTable("qualification_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "restrict", onUpdate: "restrict" }),
  questionId: text("question_id").notNull(),
  rawAnswer: text("raw_answer").notNull(),
  parsedValue: jsonb("parsed_value").$type<string | number | boolean>().notNull(),
  ...auditColumns,
});

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "restrict", onUpdate: "restrict" }),
  direction: messageDirectionEnum("direction").notNull(),
  author: messageAuthorEnum("author").notNull(),
  messageType: text("message_type").notNull(),
  body: text("body").notNull(),
  providerMessageId: text("provider_message_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ...auditColumns,
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "restrict", onUpdate: "restrict" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: appointmentStatusEnum("status").notNull().default("scheduled"),
  externalEventId: text("external_event_id"),
  confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  ...auditColumns,
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityName: text("entity_name").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before").$type<Record<string, unknown> | null>(),
  after: jsonb("after").$type<Record<string, unknown> | null>(),
  ...auditColumns,
});
