import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  activeClientDocuments,
  activeClientHistory,
  activeClientNotes,
  activeClients,
  clientAcceptanceTerms,
  clientForms,
  clientOnboardings,
  clientPendingItems,
  clientQualityChecks,
  clientTrainings,
  onboardingChecklistItems,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { clientFormTemplates, onboardingChecklistTemplate, qualityCheckTemplate, slugifyKey } from "@/lib/onboarding/defaults";

const paramsSchema = z.object({ clientId: z.string().uuid() });

export async function GET(_request: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = paramsSchema.parse(await context.params);
    const [client] = await db
      .select()
      .from(activeClients)
      .where(and(eq(activeClients.id, clientId), eq(activeClients.isDeleted, false)));

    if (!client) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });

    const onboarding = await ensureOnboarding(clientId);
    await ensureChecklist(clientId, onboarding.id);
    await ensureForms(clientId, onboarding.id);
    await ensureQualityChecks(clientId, onboarding.id);
    await recalculateOnboarding(clientId, onboarding.id);

    const [freshOnboarding] = await db.select().from(clientOnboardings).where(eq(clientOnboardings.id, onboarding.id));
    const [checklist, forms, trainings, documents, notes, history, pendingItems, qualityChecks, acceptanceTerms] =
      await Promise.all([
        db
          .select()
          .from(onboardingChecklistItems)
          .where(and(eq(onboardingChecklistItems.clientId, clientId), eq(onboardingChecklistItems.isDeleted, false)))
          .orderBy(asc(onboardingChecklistItems.sortOrder)),
        db
          .select()
          .from(clientForms)
          .where(and(eq(clientForms.clientId, clientId), eq(clientForms.isDeleted, false)))
          .orderBy(asc(clientForms.formType)),
        db
          .select()
          .from(clientTrainings)
          .where(and(eq(clientTrainings.clientId, clientId), eq(clientTrainings.isDeleted, false)))
          .orderBy(desc(clientTrainings.createdAt)),
        db
          .select()
          .from(activeClientDocuments)
          .where(and(eq(activeClientDocuments.clientId, clientId), eq(activeClientDocuments.isDeleted, false)))
          .orderBy(desc(activeClientDocuments.createdAt)),
        db
          .select()
          .from(activeClientNotes)
          .where(and(eq(activeClientNotes.clientId, clientId), eq(activeClientNotes.isDeleted, false)))
          .orderBy(desc(activeClientNotes.createdAt)),
        db
          .select()
          .from(activeClientHistory)
          .where(and(eq(activeClientHistory.clientId, clientId), eq(activeClientHistory.isDeleted, false)))
          .orderBy(desc(activeClientHistory.createdAt)),
        db
          .select()
          .from(clientPendingItems)
          .where(and(eq(clientPendingItems.clientId, clientId), eq(clientPendingItems.isDeleted, false)))
          .orderBy(desc(clientPendingItems.createdAt)),
        db
          .select()
          .from(clientQualityChecks)
          .where(and(eq(clientQualityChecks.clientId, clientId), eq(clientQualityChecks.isDeleted, false)))
          .orderBy(asc(clientQualityChecks.createdAt)),
        db
          .select()
          .from(clientAcceptanceTerms)
          .where(and(eq(clientAcceptanceTerms.clientId, clientId), eq(clientAcceptanceTerms.isDeleted, false)))
          .orderBy(desc(clientAcceptanceTerms.createdAt)),
      ]);

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
        companyName: client.companyName,
        responsibleName: client.responsibleName,
        phone: client.phone,
        email: client.email,
        city: client.city,
        stage: client.stage,
        notes: client.notes,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
      },
      onboarding: freshOnboarding ? toOnboarding(freshOnboarding) : null,
      checklist: checklist.map(toChecklistItem),
      forms: forms.map(toForm),
      trainings: trainings.map(toTraining),
      documents: documents.map(toDocument),
      notes: notes.map(toNote),
      history: history.map(toHistory),
      pendingItems: pendingItems.map(toPendingItem),
      qualityChecks: qualityChecks.map(toQualityCheck),
      acceptanceTerms: acceptanceTerms.map(toAcceptanceTerm),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_client_id", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao carregar cliente.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function ensureOnboarding(clientId: string) {
  const [existing] = await db
    .select()
    .from(clientOnboardings)
    .where(and(eq(clientOnboardings.clientId, clientId), eq(clientOnboardings.isDeleted, false)));

  if (existing) return existing;

  const now = new Date();
  const plannedCompletionAt = new Date(now);
  plannedCompletionAt.setDate(now.getDate() + 14);

  const [created] = await db
    .insert(clientOnboardings)
    .values({
      clientId,
      status: "Aguardando inicio",
      health: "Atencao",
      onboardingStartedAt: now,
      plannedCompletionAt,
      nextRecommendedAction: "Enviar boas-vindas e iniciar coleta de informacoes.",
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .returning();

  await addHistory(clientId, "onboarding_created", "Onboarding criado automaticamente para o cliente");
  return created;
}

async function ensureChecklist(clientId: string, onboardingId: string) {
  const existingItems = await db
    .select({ itemKey: onboardingChecklistItems.itemKey })
    .from(onboardingChecklistItems)
    .where(and(eq(onboardingChecklistItems.clientId, clientId), eq(onboardingChecklistItems.isDeleted, false)));
  const existingKeys = new Set(existingItems.map((item) => item.itemKey));
  const values = onboardingChecklistTemplate.flatMap((stage, stageIndex) =>
    stage.items.map((label, itemIndex) => ({
      clientId,
      onboardingId,
      stageKey: stage.key,
      stageName: stage.name,
      itemKey: `${stage.key}_${slugifyKey(label)}`,
      label,
      sortOrder: stageIndex * 100 + itemIndex,
      modifiedBy: env.SYSTEM_USER_ID,
    })),
  ).filter((item) => !existingKeys.has(item.itemKey));

  if (values.length > 0) await db.insert(onboardingChecklistItems).values(values);
}

async function ensureForms(clientId: string, onboardingId: string) {
  const existingForms = await db
    .select({ formType: clientForms.formType })
    .from(clientForms)
    .where(and(eq(clientForms.clientId, clientId), eq(clientForms.isDeleted, false)));
  const existingTypes = new Set(existingForms.map((form) => form.formType));
  const values = clientFormTemplates
    .filter((template) => !existingTypes.has(template.type))
    .map((template) => ({
      clientId,
      onboardingId,
      formType: template.type,
      data: {},
      completionPercent: 0,
      modifiedBy: env.SYSTEM_USER_ID,
    }));

  if (values.length > 0) await db.insert(clientForms).values(values);
}

async function ensureQualityChecks(clientId: string, onboardingId: string) {
  const existingItems = await db
    .select({ itemKey: clientQualityChecks.itemKey })
    .from(clientQualityChecks)
    .where(and(eq(clientQualityChecks.clientId, clientId), eq(clientQualityChecks.isDeleted, false)));
  const existingKeys = new Set(existingItems.map((item) => item.itemKey));
  const values = qualityCheckTemplate
    .map((label) => ({
      clientId,
      onboardingId,
      itemKey: slugifyKey(label),
      label,
      modifiedBy: env.SYSTEM_USER_ID,
    }))
    .filter((item) => !existingKeys.has(item.itemKey));

  if (values.length > 0) await db.insert(clientQualityChecks).values(values);
}

async function recalculateOnboarding(clientId: string, onboardingId: string) {
  const checklist = await db
    .select()
    .from(onboardingChecklistItems)
    .where(and(eq(onboardingChecklistItems.clientId, clientId), eq(onboardingChecklistItems.isDeleted, false)));
  const total = checklist.length;
  const completed = checklist.filter((item) => item.isCompleted).length;
  const blocked = checklist.filter((item) => item.isBlocked).length;
  const overdue = checklist.filter((item) => item.dueAt && !item.isCompleted && item.dueAt < new Date()).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const firstPending = checklist.find((item) => !item.isCompleted);
  const nextRecommendedAction = firstPending
    ? `${firstPending.stageName}: ${firstPending.label}.`
    : "Solicitar aceite final do cliente e concluir implantacao.";
  const status = suggestStatus(checklist, progress);

  await db
    .update(clientOnboardings)
    .set({
      progress,
      status,
      nextRecommendedAction,
      metrics: { total, completed, pending: total - completed, blocked, overdue },
      updatedAt: new Date(),
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .where(eq(clientOnboardings.id, onboardingId));
}

function suggestStatus(checklist: (typeof onboardingChecklistItems.$inferSelect)[], progress: number) {
  if (progress >= 100) return "Concluida";
  if (checklist.some((item) => item.isBlocked)) return "Aguardando cliente";
  if (checklist.some((item) => item.stageKey === "testes" && !item.isCompleted)) return "Em testes";
  if (checklist.some((item) => ["tecnica", "ia"].includes(item.stageKey) && !item.isCompleted)) return "Em configuracao";
  if (checklist.some((item) => item.stageKey === "coleta" && !item.isCompleted)) return "Em coleta de informacoes";
  return "Aguardando inicio";
}

async function addHistory(clientId: string, action: string, description: string, metadata: Record<string, unknown> = {}) {
  await db.insert(activeClientHistory).values({
    clientId,
    action,
    description,
    metadata,
    modifiedBy: env.SYSTEM_USER_ID,
  });
}

function toOnboarding(onboarding: typeof clientOnboardings.$inferSelect) {
  return {
    id: onboarding.id,
    planName: onboarding.planName,
    internalOwnerName: onboarding.internalOwnerName,
    status: onboarding.status,
    health: onboarding.health,
    contractedAt: onboarding.contractedAt?.toISOString() ?? null,
    onboardingStartedAt: onboarding.onboardingStartedAt?.toISOString() ?? null,
    plannedCompletionAt: onboarding.plannedCompletionAt?.toISOString() ?? null,
    completedAt: onboarding.completedAt?.toISOString() ?? null,
    progress: onboarding.progress,
    nextRecommendedAction: onboarding.nextRecommendedAction,
    metrics: onboarding.metrics,
  };
}

function toChecklistItem(item: typeof onboardingChecklistItems.$inferSelect) {
  return {
    id: item.id,
    stageKey: item.stageKey,
    stageName: item.stageName,
    itemKey: item.itemKey,
    label: item.label,
    isRequired: item.isRequired,
    isCompleted: item.isCompleted,
    isBlocked: item.isBlocked,
    responsibleName: item.responsibleName,
    dueAt: item.dueAt?.toISOString() ?? null,
    notes: item.notes,
    documentUrl: item.documentUrl,
    completedAt: item.completedAt?.toISOString() ?? null,
    completedBy: item.completedBy,
    blockReason: item.blockReason,
  };
}

function toForm(form: typeof clientForms.$inferSelect) {
  return {
    id: form.id,
    formType: form.formType,
    data: form.data,
    completionPercent: form.completionPercent,
    lastEditedBy: form.lastEditedBy,
    updatedAt: form.updatedAt.toISOString(),
  };
}

function toTraining(training: typeof clientTrainings.$inferSelect) {
  return {
    id: training.id,
    title: training.title,
    type: training.type,
    scheduledAt: training.scheduledAt?.toISOString() ?? null,
    durationMinutes: training.durationMinutes,
    fxpOwnerName: training.fxpOwnerName,
    participants: training.participants,
    meetingUrl: training.meetingUrl,
    contentCovered: training.contentCovered,
    questions: training.questions,
    status: training.status,
    notes: training.notes,
    materialUrl: training.materialUrl,
    teamTrained: training.teamTrained,
    needsReinforcement: training.needsReinforcement,
    newTrainingNeeded: training.newTrainingNeeded,
  };
}

function toDocument(document: typeof activeClientDocuments.$inferSelect) {
  return {
    id: document.id,
    name: document.name,
    type: document.type,
    description: document.description,
    fileUrl: document.fileUrl,
    createdAt: document.createdAt.toISOString(),
  };
}

function toNote(note: typeof activeClientNotes.$inferSelect) {
  return {
    id: note.id,
    body: note.body,
    authorName: note.authorName,
    createdAt: note.createdAt.toISOString(),
  };
}

function toHistory(history: typeof activeClientHistory.$inferSelect) {
  return {
    id: history.id,
    action: history.action,
    description: history.description,
    metadata: history.metadata,
    createdAt: history.createdAt.toISOString(),
  };
}

function toPendingItem(item: typeof clientPendingItems.$inferSelect) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    responsibleName: item.responsibleName,
    origin: item.origin,
    priority: item.priority,
    dueAt: item.dueAt?.toISOString() ?? null,
    status: item.status,
    dependency: item.dependency,
    notes: item.notes,
  };
}

function toQualityCheck(item: typeof clientQualityChecks.$inferSelect) {
  return {
    id: item.id,
    itemKey: item.itemKey,
    label: item.label,
    isRequired: item.isRequired,
    isCompleted: item.isCompleted,
    completedAt: item.completedAt?.toISOString() ?? null,
    completedBy: item.completedBy,
    exceptionJustification: item.exceptionJustification,
  };
}

function toAcceptanceTerm(term: typeof clientAcceptanceTerms.$inferSelect) {
  return {
    id: term.id,
    clientName: term.clientName,
    responsibleName: term.responsibleName,
    acceptedAt: term.acceptedAt?.toISOString() ?? null,
    deliveredItems: term.deliveredItems,
    knownPendingItems: term.knownPendingItems,
    notes: term.notes,
    fxpResponsibleName: term.fxpResponsibleName,
    clientConfirmation: term.clientConfirmation,
    signedTermUrl: term.signedTermUrl,
  };
}
