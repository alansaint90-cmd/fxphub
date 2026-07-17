import {
  boolean,
  integer,
  index,
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
export const activeClientStageEnum = pgEnum("active_client_stage", [
  "documentos",
  "onboarding",
  "implantacao",
  "treinamento",
  "acompanhamento",
  "renovacao",
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
    responsibleName: text("responsible_name"),
    drivingSchoolName: text("driving_school_name"),
    city: text("city"),
    monthlyEnrollments: integer("monthly_enrollments"),
    commercialAttendants: integer("commercial_attendants"),
    usesCrm: boolean("uses_crm"),
    runsPaidTraffic: boolean("runs_paid_traffic"),
    mainPain: text("main_pain"),
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

export const integrationSettings = pgTable(
  "integration_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    isSecret: boolean("is_secret").notNull().default(false),
    ...auditColumns,
  },
  (table) => ({
    keyIdx: uniqueIndex("integration_settings_key_idx").on(table.key),
  }),
);

export const activeClients = pgTable("active_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  responsibleName: text("responsible_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  stage: activeClientStageEnum("stage").notNull().default("documentos"),
  notes: text("notes"),
  ...auditColumns,
});

export const activeClientCredentials = pgTable("active_client_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
  label: text("label").notNull(),
  url: text("url"),
  username: text("username"),
  password: text("password"),
  apiKey: text("api_key"),
  token: text("token"),
  notes: text("notes"),
  ...auditColumns,
});

export const activeClientDocuments = pgTable("active_client_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  ...auditColumns,
});

export const activeClientNotes = pgTable("active_client_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
  body: text("body").notNull(),
  authorName: text("author_name").notNull().default("Sistema"),
  ...auditColumns,
});

export const activeClientHistory = pgTable("active_client_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
  action: text("action").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ...auditColumns,
});

export const clientOnboardings = pgTable(
  "client_onboardings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
    planName: text("plan_name"),
    internalOwnerName: text("internal_owner_name"),
    status: text("status").notNull().default("Aguardando inicio"),
    health: text("health").notNull().default("Atencao"),
    contractedAt: timestamp("contracted_at", { withTimezone: true }),
    onboardingStartedAt: timestamp("onboarding_started_at", { withTimezone: true }),
    configurationStartedAt: timestamp("configuration_started_at", { withTimezone: true }),
    testsStartedAt: timestamp("tests_started_at", { withTimezone: true }),
    trainingAt: timestamp("training_at", { withTimezone: true }),
    plannedCompletionAt: timestamp("planned_completion_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    progress: integer("progress").notNull().default(0),
    nextRecommendedAction: text("next_recommended_action"),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
    ...auditColumns,
  },
  (table) => ({
    clientIdx: index("client_onboardings_client_idx").on(table.clientId),
    statusIdx: index("client_onboardings_status_idx").on(table.status),
    ownerIdx: index("client_onboardings_owner_idx").on(table.internalOwnerName),
  }),
);

export const onboardingChecklistItems = pgTable(
  "onboarding_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => clientOnboardings.id, { onDelete: "restrict", onUpdate: "restrict" }),
    stageKey: text("stage_key").notNull(),
    stageName: text("stage_name").notNull(),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(true),
    isCompleted: boolean("is_completed").notNull().default(false),
    isBlocked: boolean("is_blocked").notNull().default(false),
    responsibleName: text("responsible_name"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    notes: text("notes"),
    documentUrl: text("document_url"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: text("completed_by"),
    blockReason: text("block_reason"),
    ...auditColumns,
  },
  (table) => ({
    clientIdx: index("onboarding_checklist_client_idx").on(table.clientId),
    statusIdx: index("onboarding_checklist_status_idx").on(table.isCompleted, table.isBlocked),
    dueIdx: index("onboarding_checklist_due_idx").on(table.dueAt),
  }),
);

export const clientForms = pgTable(
  "client_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => clientOnboardings.id, { onDelete: "restrict", onUpdate: "restrict" }),
    formType: text("form_type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    completionPercent: integer("completion_percent").notNull().default(0),
    lastEditedBy: text("last_edited_by"),
    copiedToAiAt: timestamp("copied_to_ai_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => ({
    clientTypeIdx: uniqueIndex("client_forms_client_type_idx").on(table.clientId, table.formType),
  }),
);

export const clientTrainings = pgTable(
  "client_trainings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => clientOnboardings.id, { onDelete: "restrict", onUpdate: "restrict" }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
    fxpOwnerName: text("fxp_owner_name"),
    participants: text("participants"),
    meetingUrl: text("meeting_url"),
    contentCovered: text("content_covered"),
    questions: text("questions"),
    status: text("status").notNull().default("Agendado"),
    notes: text("notes"),
    materialUrl: text("material_url"),
    teamTrained: boolean("team_trained").notNull().default(false),
    needsReinforcement: boolean("needs_reinforcement").notNull().default(false),
    newTrainingNeeded: boolean("new_training_needed").notNull().default(false),
    ...auditColumns,
  },
  (table) => ({
    clientIdx: index("client_trainings_client_idx").on(table.clientId),
    statusIdx: index("client_trainings_status_idx").on(table.status),
  }),
);

export const clientPendingItems = pgTable(
  "client_pending_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => clientOnboardings.id, { onDelete: "restrict", onUpdate: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    responsibleName: text("responsible_name"),
    origin: text("origin"),
    priority: text("priority").notNull().default("Media"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").notNull().default("Aberta"),
    dependency: text("dependency"),
    notes: text("notes"),
    ...auditColumns,
  },
  (table) => ({
    clientIdx: index("client_pending_items_client_idx").on(table.clientId),
    statusIdx: index("client_pending_items_status_idx").on(table.status),
    dueIdx: index("client_pending_items_due_idx").on(table.dueAt),
  }),
);

export const clientQualityChecks = pgTable(
  "client_quality_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => clientOnboardings.id, { onDelete: "restrict", onUpdate: "restrict" }),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: text("completed_by"),
    exceptionJustification: text("exception_justification"),
    ...auditColumns,
  },
  (table) => ({
    clientIdx: index("client_quality_checks_client_idx").on(table.clientId),
  }),
);

export const clientAcceptanceTerms = pgTable(
  "client_acceptance_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => activeClients.id, { onDelete: "restrict", onUpdate: "restrict" }),
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => clientOnboardings.id, { onDelete: "restrict", onUpdate: "restrict" }),
    clientName: text("client_name").notNull(),
    responsibleName: text("responsible_name").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    deliveredItems: text("delivered_items"),
    knownPendingItems: text("known_pending_items"),
    notes: text("notes"),
    fxpResponsibleName: text("fxp_responsible_name"),
    clientConfirmation: boolean("client_confirmation").notNull().default(false),
    signedTermUrl: text("signed_term_url"),
    printableVersion: text("printable_version"),
    ...auditColumns,
  },
  (table) => ({
    clientIdx: index("client_acceptance_terms_client_idx").on(table.clientId),
  }),
);

export const leadForms = pgTable(
  "lead_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    businessName: text("business_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    city: text("city"),
    state: text("state"),
    role: text("role"),
    paidTrafficReason: text("paid_traffic_reason"),
    currentDailyLeads: text("current_daily_leads"),
    desiredDailyLeads: text("desired_daily_leads"),
    attendanceStructure: text("attendance_structure"),
    strategyOpenness: text("strategy_openness"),
    diagnosticStatus: text("diagnostic_status"),
    diagnosticSummary: text("diagnostic_summary"),
    diagnosticAnswers: jsonb("diagnostic_answers").$type<Record<string, unknown>>().notNull().default({}),
    monthlyEnrollments: integer("monthly_enrollments").notNull().default(0),
    salesAttendants: integer("sales_attendants").notNull().default(0),
    usesCrm: text("uses_crm"),
    crmName: text("crm_name"),
    runsPaidAds: text("runs_paid_ads"),
    monthlyAdSpend: integer("monthly_ad_spend"),
    mainChallenge: text("main_challenge"),
    responseTime: text("response_time"),
    wantsWhatsappAutomation: text("wants_whatsapp_automation"),
    meetingInterest: text("meeting_interest").notNull(),
    preferredMeetingPeriod: text("preferred_meeting_period"),
    contactAuthorized: boolean("contact_authorized").notNull().default(false),
    privacyPolicyAccepted: boolean("privacy_policy_accepted").notNull().default(false),
    qualificationScore: integer("qualification_score").notNull().default(0),
    qualificationStatus: text("qualification_status").notNull().default("unqualified"),
    disqualificationReason: text("disqualification_reason"),
    leadStatus: text("lead_status").notNull().default("Formulario concluido"),
    whatsappClicked: boolean("whatsapp_clicked").notNull().default(false),
    whatsappClickedAt: timestamp("whatsapp_clicked_at", { withTimezone: true }),
    faustoContactStarted: boolean("fausto_contact_started").notNull().default(false),
    meetingScheduled: boolean("meeting_scheduled").notNull().default(false),
    meetingDate: timestamp("meeting_date", { withTimezone: true }),
    meetingAttended: boolean("meeting_attended").notNull().default(false),
    dealClosed: boolean("deal_closed").notNull().default(false),
    dealValue: integer("deal_value"),
    source: text("source"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    campaignId: text("campaign_id"),
    adsetId: text("adset_id"),
    adId: text("ad_id"),
    fbclid: text("fbclid"),
    fbc: text("fbc"),
    fbp: text("fbp"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    landingPageUrl: text("landing_page_url"),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    ...auditColumns,
  },
  (table) => ({
    statusIdx: index("lead_forms_status_idx").on(table.qualificationStatus, table.leadStatus),
    phoneIdx: index("lead_forms_phone_idx").on(table.phone),
    campaignIdx: index("lead_forms_campaign_idx").on(table.utmCampaign),
  }),
);

export const leadFormEvents = pgTable(
  "lead_form_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leadForms.id, { onDelete: "restrict", onUpdate: "restrict" }),
    eventName: text("event_name").notNull(),
    eventId: text("event_id").notNull(),
    eventSource: text("event_source").notNull().default("form"),
    eventData: jsonb("event_data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index("lead_form_events_lead_idx").on(table.leadId),
    eventIdx: index("lead_form_events_event_idx").on(table.eventName),
  }),
);

export const leadFormSettings = pgTable(
  "lead_form_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formName: text("form_name").notNull().default("Diagnostico Autoescola"),
    slug: text("slug").notNull().default("diagnostico-autoescola"),
    title: text("title").notNull().default("Diagnostico comercial para autoescolas"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    whatsappInstanceId: text("whatsapp_instance_id"),
    whatsappNumber: text("whatsapp_number"),
    qualifiedMessage: text("qualified_message"),
    unqualifiedMessage: text("unqualified_message"),
    qualifiedMinScore: integer("qualified_min_score").notNull().default(50),
    instagramUrl: text("instagram_url"),
    privacyPolicyUrl: text("privacy_policy_url"),
    metaPixelId: text("meta_pixel_id"),
    metaCapiToken: text("meta_capi_token"),
    metaTestEventCode: text("meta_test_event_code"),
    ...auditColumns,
  },
  (table) => ({
    slugIdx: uniqueIndex("lead_form_settings_slug_idx").on(table.slug),
  }),
);

export const leadQualificationRules = pgTable("lead_qualification_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  fieldName: text("field_name").notNull(),
  operator: text("operator").notNull(),
  fieldValue: text("field_value").notNull(),
  score: integer("score").notNull().default(0),
  classificationAction: text("classification_action"),
  isActive: boolean("is_active").notNull().default(true),
  ...auditColumns,
});
