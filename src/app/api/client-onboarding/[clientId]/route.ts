import { and, eq } from "drizzle-orm";
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

const paramsSchema = z.object({ clientId: z.string().uuid() });

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_status"),
    onboardingId: z.string().uuid(),
    status: z.string().trim().min(2),
    health: z.string().trim().optional(),
    planName: z.string().trim().optional(),
    internalOwnerName: z.string().trim().optional(),
    plannedCompletionAt: z.string().datetime().optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("update_checklist_item"),
    itemId: z.string().uuid(),
    isCompleted: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
    responsibleName: z.string().trim().optional(),
    dueAt: z.string().datetime().optional().or(z.literal("")),
    notes: z.string().trim().optional(),
    documentUrl: z.string().trim().optional(),
    blockReason: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("save_form"),
    formId: z.string().uuid(),
    data: z.record(z.string(), z.unknown()),
    completionPercent: z.number().int().min(0).max(100),
    lastEditedBy: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("add_training"),
    onboardingId: z.string().uuid(),
    title: z.string().trim().min(2),
    type: z.string().trim().min(2),
    scheduledAt: z.string().datetime().optional().or(z.literal("")),
    durationMinutes: z.number().int().positive().optional(),
    fxpOwnerName: z.string().trim().optional(),
    participants: z.string().trim().optional(),
    meetingUrl: z.string().trim().optional(),
    contentCovered: z.string().trim().optional(),
    questions: z.string().trim().optional(),
    status: z.string().trim().min(2).default("Agendado"),
    notes: z.string().trim().optional(),
    materialUrl: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("add_pending_item"),
    onboardingId: z.string().uuid(),
    title: z.string().trim().min(2),
    description: z.string().trim().optional(),
    category: z.string().trim().optional(),
    responsibleName: z.string().trim().optional(),
    origin: z.string().trim().optional(),
    priority: z.string().trim().min(2).default("Media"),
    dueAt: z.string().datetime().optional().or(z.literal("")),
    status: z.string().trim().min(2).default("Aberta"),
    dependency: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("update_pending_status"),
    pendingId: z.string().uuid(),
    status: z.string().trim().min(2),
  }),
  z.object({
    action: z.literal("update_quality_check"),
    qualityId: z.string().uuid(),
    isCompleted: z.boolean(),
    exceptionJustification: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("register_acceptance"),
    onboardingId: z.string().uuid(),
    clientName: z.string().trim().min(2),
    responsibleName: z.string().trim().min(2),
    acceptedAt: z.string().datetime().optional().or(z.literal("")),
    deliveredItems: z.string().trim().optional(),
    knownPendingItems: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    fxpResponsibleName: z.string().trim().optional(),
    clientConfirmation: z.boolean().default(false),
    signedTermUrl: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("add_note"),
    body: z.string().trim().min(2),
    authorName: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("add_document"),
    name: z.string().trim().min(2),
    type: z.string().trim().min(2),
    description: z.string().trim().optional(),
    fileUrl: z.string().trim().optional(),
  }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = paramsSchema.parse(await context.params);
    const input = patchSchema.parse(await request.json());
    const [client] = await db
      .select()
      .from(activeClients)
      .where(and(eq(activeClients.id, clientId), eq(activeClients.isDeleted, false)));

    if (!client) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });

    if (input.action === "update_status") {
      await db
        .update(clientOnboardings)
        .set({
          status: input.status,
          ...(input.health !== undefined ? { health: input.health } : {}),
          ...(input.planName !== undefined ? { planName: input.planName } : {}),
          ...(input.internalOwnerName !== undefined ? { internalOwnerName: input.internalOwnerName } : {}),
          ...(input.plannedCompletionAt !== undefined
            ? { plannedCompletionAt: input.plannedCompletionAt ? new Date(input.plannedCompletionAt) : null }
            : {}),
          updatedAt: new Date(),
          modifiedBy: env.SYSTEM_USER_ID,
        })
        .where(and(eq(clientOnboardings.id, input.onboardingId), eq(clientOnboardings.clientId, clientId)));
      await addHistory(clientId, "onboarding_status_updated", `Status da implantacao alterado para ${input.status}`);
    }

    if (input.action === "update_checklist_item") {
      const completed = input.isCompleted === true;
      await db
        .update(onboardingChecklistItems)
        .set({
          ...(input.isCompleted !== undefined
            ? {
                isCompleted: input.isCompleted,
                completedAt: completed ? new Date() : null,
                completedBy: completed ? "Sistema" : null,
              }
            : {}),
          ...(input.isBlocked !== undefined ? { isBlocked: input.isBlocked } : {}),
          ...(input.responsibleName !== undefined ? { responsibleName: input.responsibleName } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.documentUrl !== undefined ? { documentUrl: input.documentUrl } : {}),
          ...(input.blockReason !== undefined ? { blockReason: input.blockReason } : {}),
          updatedAt: new Date(),
          modifiedBy: env.SYSTEM_USER_ID,
        })
        .where(and(eq(onboardingChecklistItems.id, input.itemId), eq(onboardingChecklistItems.clientId, clientId)));
      await addHistory(clientId, completed ? "checklist_item_completed" : "checklist_item_updated", "Checklist de implantacao atualizado");
    }

    if (input.action === "save_form") {
      await db
        .update(clientForms)
        .set({
          data: input.data,
          completionPercent: input.completionPercent,
          lastEditedBy: input.lastEditedBy || "Sistema",
          updatedAt: new Date(),
          modifiedBy: env.SYSTEM_USER_ID,
        })
        .where(and(eq(clientForms.id, input.formId), eq(clientForms.clientId, clientId)));
      await addHistory(clientId, "form_saved", `Formulario salvo com ${input.completionPercent}% de preenchimento`);
    }

    if (input.action === "add_training") {
      await db.insert(clientTrainings).values({
        clientId,
        onboardingId: input.onboardingId,
        title: input.title,
        type: input.type,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        durationMinutes: input.durationMinutes,
        fxpOwnerName: input.fxpOwnerName,
        participants: input.participants,
        meetingUrl: input.meetingUrl,
        contentCovered: input.contentCovered,
        questions: input.questions,
        status: input.status,
        notes: input.notes,
        materialUrl: input.materialUrl,
        modifiedBy: env.SYSTEM_USER_ID,
      });
      await addHistory(clientId, "training_registered", `Treinamento registrado: ${input.title}`);
    }

    if (input.action === "add_pending_item") {
      await db.insert(clientPendingItems).values({
        clientId,
        onboardingId: input.onboardingId,
        title: input.title,
        description: input.description,
        category: input.category,
        responsibleName: input.responsibleName,
        origin: input.origin,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        status: input.status,
        dependency: input.dependency,
        notes: input.notes,
        modifiedBy: env.SYSTEM_USER_ID,
      });
      await addHistory(clientId, "pending_item_created", `Pendencia criada: ${input.title}`);
    }

    if (input.action === "update_pending_status") {
      await db
        .update(clientPendingItems)
        .set({ status: input.status, updatedAt: new Date(), modifiedBy: env.SYSTEM_USER_ID })
        .where(and(eq(clientPendingItems.id, input.pendingId), eq(clientPendingItems.clientId, clientId)));
      await addHistory(clientId, "pending_item_updated", `Status da pendencia alterado para ${input.status}`);
    }

    if (input.action === "update_quality_check") {
      await db
        .update(clientQualityChecks)
        .set({
          isCompleted: input.isCompleted,
          completedAt: input.isCompleted ? new Date() : null,
          completedBy: input.isCompleted ? "Sistema" : null,
          exceptionJustification: input.exceptionJustification,
          updatedAt: new Date(),
          modifiedBy: env.SYSTEM_USER_ID,
        })
        .where(and(eq(clientQualityChecks.id, input.qualityId), eq(clientQualityChecks.clientId, clientId)));
      await addHistory(clientId, "quality_check_updated", "Controle de qualidade atualizado");
    }

    if (input.action === "register_acceptance") {
      await db.insert(clientAcceptanceTerms).values({
        clientId,
        onboardingId: input.onboardingId,
        clientName: input.clientName,
        responsibleName: input.responsibleName,
        acceptedAt: input.acceptedAt ? new Date(input.acceptedAt) : new Date(),
        deliveredItems: input.deliveredItems,
        knownPendingItems: input.knownPendingItems,
        notes: input.notes,
        fxpResponsibleName: input.fxpResponsibleName,
        clientConfirmation: input.clientConfirmation,
        signedTermUrl: input.signedTermUrl,
        modifiedBy: env.SYSTEM_USER_ID,
      });
      await addHistory(clientId, "acceptance_registered", "Termo de aceite registrado");
    }

    if (input.action === "add_note") {
      await db.insert(activeClientNotes).values({
        clientId,
        body: input.body,
        authorName: input.authorName || "Sistema",
        modifiedBy: env.SYSTEM_USER_ID,
      });
      await addHistory(clientId, "note_added", "Observacao adicionada");
    }

    if (input.action === "add_document") {
      await db.insert(activeClientDocuments).values({
        clientId,
        name: input.name,
        type: input.type,
        description: input.description,
        fileUrl: input.fileUrl,
        modifiedBy: env.SYSTEM_USER_ID,
      });
      await addHistory(clientId, "document_added", `Documento adicionado: ${input.name}`);
    }

    await touchClient(clientId);
    await recalculateOnboarding(clientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_onboarding_action", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao salvar onboarding.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function touchClient(clientId: string) {
  await db
    .update(activeClients)
    .set({ updatedAt: new Date(), modifiedBy: env.SYSTEM_USER_ID })
    .where(eq(activeClients.id, clientId));
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

async function recalculateOnboarding(clientId: string) {
  const [onboarding] = await db
    .select()
    .from(clientOnboardings)
    .where(and(eq(clientOnboardings.clientId, clientId), eq(clientOnboardings.isDeleted, false)));
  if (!onboarding) return;

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

  await db
    .update(clientOnboardings)
    .set({
      progress,
      nextRecommendedAction: firstPending
        ? `${firstPending.stageName}: ${firstPending.label}.`
        : "Solicitar aceite final do cliente e concluir implantacao.",
      metrics: { total, completed, pending: total - completed, blocked, overdue },
      updatedAt: new Date(),
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .where(eq(clientOnboardings.id, onboarding.id));
}
