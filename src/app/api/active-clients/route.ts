import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  activeClientCredentials,
  activeClientDocuments,
  activeClientHistory,
  activeClientNotes,
  activeClients,
} from "@/lib/db/schema";
import { env } from "@/lib/env";

const clientStageSchema = z.enum([
  "documentos",
  "onboarding",
  "implantacao",
  "treinamento",
  "acompanhamento",
  "renovacao",
]);

const createClientSchema = z.object({
  companyName: z.string().trim().min(2),
  responsibleName: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  email: z.string().trim().email().optional().or(z.literal("")),
  city: z.string().trim().optional(),
  stage: clientStageSchema.default("documentos"),
  notes: z.string().trim().optional(),
});

const updateClientSchema = createClientSchema.partial().extend({
  id: z.string().uuid(),
  action: z.literal("update_client"),
});

const updateStageSchema = z.object({
  id: z.string().uuid(),
  action: z.literal("update_stage"),
  stage: clientStageSchema,
});

const deleteClientSchema = z.object({
  id: z.string().uuid(),
  action: z.literal("delete_client"),
});

const credentialSchema = z.object({
  clientId: z.string().uuid(),
  action: z.literal("add_credential"),
  label: z.string().trim().min(2),
  url: z.string().trim().optional(),
  username: z.string().trim().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  token: z.string().optional(),
  notes: z.string().trim().optional(),
});

const documentSchema = z.object({
  clientId: z.string().uuid(),
  action: z.literal("add_document"),
  name: z.string().trim().min(2),
  type: z.string().trim().min(2),
  description: z.string().trim().optional(),
  fileUrl: z.string().trim().optional(),
});

const noteSchema = z.object({
  clientId: z.string().uuid(),
  action: z.literal("add_note"),
  body: z.string().trim().min(2),
  authorName: z.string().trim().optional(),
});

const deleteChildSchema = z.object({
  clientId: z.string().uuid(),
  id: z.string().uuid(),
  action: z.enum(["delete_credential", "delete_document", "delete_note"]),
});

const patchSchema = z.discriminatedUnion("action", [
  updateClientSchema,
  updateStageSchema,
  deleteClientSchema,
  credentialSchema,
  documentSchema,
  noteSchema,
  deleteChildSchema,
]);

export async function GET() {
  try {
    const clients = await db
      .select()
      .from(activeClients)
      .where(eq(activeClients.isDeleted, false))
      .orderBy(desc(activeClients.updatedAt))
      .limit(120);

    const clientIds = clients.map((client) => client.id);
    const [credentials, documents, notes, history] =
      clientIds.length > 0
        ? await Promise.all([
            db
              .select()
              .from(activeClientCredentials)
              .where(
                and(
                  eq(activeClientCredentials.isDeleted, false),
                  inArray(activeClientCredentials.clientId, clientIds),
                ),
              ),
            db
              .select()
              .from(activeClientDocuments)
              .where(
                and(
                  eq(activeClientDocuments.isDeleted, false),
                  inArray(activeClientDocuments.clientId, clientIds),
                ),
              ),
            db
              .select()
              .from(activeClientNotes)
              .where(and(eq(activeClientNotes.isDeleted, false), inArray(activeClientNotes.clientId, clientIds)))
              .orderBy(desc(activeClientNotes.createdAt)),
            db
              .select()
              .from(activeClientHistory)
              .where(and(eq(activeClientHistory.isDeleted, false), inArray(activeClientHistory.clientId, clientIds)))
              .orderBy(desc(activeClientHistory.createdAt)),
          ])
        : [[], [], [], []];

    return NextResponse.json({
      ok: true,
      clients: clients.map((client) => ({
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
        credentials: credentials.filter((item) => item.clientId === client.id).map(toCredential),
        documents: documents.filter((item) => item.clientId === client.id).map(toDocument),
        observations: notes.filter((item) => item.clientId === client.id).map(toNote),
        history: history.filter((item) => item.clientId === client.id).map(toHistory),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar clientes ativos.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = createClientSchema.parse(await request.json());
    const [client] = await db
      .insert(activeClients)
      .values({
        companyName: input.companyName,
        responsibleName: input.responsibleName,
        phone: input.phone,
        email: input.email || undefined,
        city: input.city,
        stage: input.stage,
        notes: input.notes,
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .returning();

    await addHistory(client.id, "client_created", `Cliente cadastrado em ${stageLabel(client.stage)}`);
    return NextResponse.json({ ok: true, id: client.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_active_client", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao salvar cliente ativo.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const input = patchSchema.parse(await request.json());

    if (input.action === "update_client") return updateClient(input);
    if (input.action === "update_stage") return updateStage(input.id, input.stage);
    if (input.action === "delete_client") return deleteClient(input.id);
    if (input.action === "add_credential") return addCredential(input);
    if (input.action === "add_document") return addDocument(input);
    if (input.action === "add_note") return addNote(input);

    return deleteChild(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_active_client_action", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao atualizar cliente ativo.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function updateClient(input: z.infer<typeof updateClientSchema>) {
  const [client] = await db
    .update(activeClients)
    .set({
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.responsibleName !== undefined ? { responsibleName: input.responsibleName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .where(and(eq(activeClients.id, input.id), eq(activeClients.isDeleted, false)))
    .returning();

  if (!client) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });
  await addHistory(client.id, "client_updated", "Informacoes do cliente atualizadas");
  return NextResponse.json({ ok: true, id: client.id });
}

async function updateStage(id: string, stage: z.infer<typeof clientStageSchema>) {
  const [currentClient] = await db.select().from(activeClients).where(and(eq(activeClients.id, id), eq(activeClients.isDeleted, false)));
  if (!currentClient) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });

  const [client] = await db
    .update(activeClients)
    .set({ stage, updatedAt: new Date(), modifiedBy: env.SYSTEM_USER_ID })
    .where(eq(activeClients.id, id))
    .returning();

  await addHistory(client.id, "stage_changed", `Alterado de ${stageLabel(currentClient.stage)} para ${stageLabel(stage)}`);
  return NextResponse.json({ ok: true, id: client.id });
}

async function deleteClient(id: string) {
  const [client] = await db
    .update(activeClients)
    .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), modifiedBy: env.SYSTEM_USER_ID })
    .where(and(eq(activeClients.id, id), eq(activeClients.isDeleted, false)))
    .returning();

  if (!client) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });
  await addHistory(client.id, "client_deleted", "Cliente excluido");
  return NextResponse.json({ ok: true, id: client.id });
}

async function addCredential(input: z.infer<typeof credentialSchema>) {
  const [credential] = await db
    .insert(activeClientCredentials)
    .values({
      clientId: input.clientId,
      label: input.label,
      url: input.url,
      username: input.username,
      password: input.password,
      apiKey: input.apiKey,
      token: input.token,
      notes: input.notes,
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .returning();

  await touchClient(input.clientId);
  await addHistory(input.clientId, "credential_added", `Credencial adicionada: ${input.label}`);
  return NextResponse.json({ ok: true, id: credential.id });
}

async function addDocument(input: z.infer<typeof documentSchema>) {
  const [document] = await db
    .insert(activeClientDocuments)
    .values({
      clientId: input.clientId,
      name: input.name,
      type: input.type,
      description: input.description,
      fileUrl: input.fileUrl,
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .returning();

  await touchClient(input.clientId);
  await addHistory(input.clientId, "document_added", `Documento adicionado: ${input.name}`);
  return NextResponse.json({ ok: true, id: document.id });
}

async function addNote(input: z.infer<typeof noteSchema>) {
  const [note] = await db
    .insert(activeClientNotes)
    .values({
      clientId: input.clientId,
      body: input.body,
      authorName: input.authorName || "Sistema",
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .returning();

  await touchClient(input.clientId);
  await addHistory(input.clientId, "note_added", "Observacao adicionada");
  return NextResponse.json({ ok: true, id: note.id });
}

async function deleteChild(input: z.infer<typeof deleteChildSchema>) {
  if (input.action === "delete_credential") {
    await db
      .update(activeClientCredentials)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), modifiedBy: env.SYSTEM_USER_ID })
      .where(and(eq(activeClientCredentials.id, input.id), eq(activeClientCredentials.clientId, input.clientId)));
    await addHistory(input.clientId, "credential_deleted", "Credencial excluida");
  }

  if (input.action === "delete_document") {
    await db
      .update(activeClientDocuments)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), modifiedBy: env.SYSTEM_USER_ID })
      .where(and(eq(activeClientDocuments.id, input.id), eq(activeClientDocuments.clientId, input.clientId)));
    await addHistory(input.clientId, "document_deleted", "Documento excluido");
  }

  if (input.action === "delete_note") {
    await db
      .update(activeClientNotes)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), modifiedBy: env.SYSTEM_USER_ID })
      .where(and(eq(activeClientNotes.id, input.id), eq(activeClientNotes.clientId, input.clientId)));
    await addHistory(input.clientId, "note_deleted", "Observacao excluida");
  }

  await touchClient(input.clientId);
  return NextResponse.json({ ok: true, id: input.id });
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

function toCredential(credential: typeof activeClientCredentials.$inferSelect) {
  return {
    id: credential.id,
    label: credential.label,
    url: credential.url,
    username: credential.username,
    password: credential.password,
    apiKey: credential.apiKey,
    token: credential.token,
    notes: credential.notes,
    createdAt: credential.createdAt.toISOString(),
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
    createdAt: history.createdAt.toISOString(),
  };
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    documentos: "Documentacao",
    onboarding: "Onboarding",
    implantacao: "Implementacao",
    treinamento: "Treinamento",
    acompanhamento: "Acompanhamento",
    renovacao: "Renovacao",
  };

  return labels[stage] ?? stage;
}
