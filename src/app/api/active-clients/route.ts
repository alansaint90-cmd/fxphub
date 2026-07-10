import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { activeClientCredentials, activeClients } from "@/lib/db/schema";
import { env } from "@/lib/env";

const clientStageSchema = z.enum([
  "documentos",
  "onboarding",
  "implantacao",
  "treinamento",
  "acompanhamento",
  "renovacao",
]);

const credentialSchema = z.object({
  label: z.string().trim().min(2),
  url: z.string().trim().optional(),
  username: z.string().trim().optional(),
  password: z.string().optional(),
  notes: z.string().trim().optional(),
});

const createClientSchema = z.object({
  companyName: z.string().trim().min(2),
  responsibleName: z.string().trim().min(2),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  city: z.string().trim().optional(),
  stage: clientStageSchema.default("documentos"),
  notes: z.string().trim().optional(),
  credentials: z.array(credentialSchema).max(10).default([]),
});

const updateClientSchema = createClientSchema.partial().extend({
  id: z.string().uuid(),
});

export async function GET() {
  try {
    const clients = await db
      .select()
      .from(activeClients)
      .where(eq(activeClients.isDeleted, false))
      .orderBy(desc(activeClients.updatedAt))
      .limit(80);

    const clientIds = clients.map((client) => client.id);
    const credentials =
      clientIds.length > 0
        ? await db
            .select()
            .from(activeClientCredentials)
            .where(
              and(
                eq(activeClientCredentials.isDeleted, false),
                inArray(activeClientCredentials.clientId, clientIds),
              ),
            )
        : [];

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
        credentials: credentials
          .filter((credential) => credential.clientId === client.id)
          .map((credential) => ({
            id: credential.id,
            label: credential.label,
            url: credential.url,
            username: credential.username,
            password: credential.password,
            notes: credential.notes,
          })),
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
        email: input.email,
        city: input.city,
        stage: input.stage,
        notes: input.notes,
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .returning();

    await replaceCredentials(client.id, input.credentials);
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
    const input = updateClientSchema.parse(await request.json());
    const [client] = await db
      .update(activeClients)
      .set({
        ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
        ...(input.responsibleName !== undefined ? { responsibleName: input.responsibleName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .where(and(eq(activeClients.id, input.id), eq(activeClients.isDeleted, false)))
      .returning();

    if (!client) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });
    if (input.credentials) await replaceCredentials(client.id, input.credentials);

    return NextResponse.json({ ok: true, id: client.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_active_client_update", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao atualizar cliente ativo.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function replaceCredentials(clientId: string, credentials: z.infer<typeof credentialSchema>[]) {
  await db
    .update(activeClientCredentials)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .where(and(eq(activeClientCredentials.clientId, clientId), eq(activeClientCredentials.isDeleted, false)));

  if (credentials.length === 0) return;

  await db.insert(activeClientCredentials).values(
    credentials.map((credential) => ({
      clientId,
      label: credential.label,
      url: credential.url,
      username: credential.username,
      password: credential.password,
      notes: credential.notes,
      modifiedBy: env.SYSTEM_USER_ID,
    })),
  );
}
