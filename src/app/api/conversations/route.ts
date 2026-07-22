import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversationMessages, leads } from "@/lib/db/schema";

export async function GET() {
  try {
    const recentLeads = await db
      .select({
        id: leads.id,
        phone: leads.phone,
        pushName: leads.pushName,
        responsibleName: leads.responsibleName,
        drivingSchoolName: leads.drivingSchoolName,
        aiPaused: leads.aiPaused,
        funnelStage: leads.funnelStage,
        lastInteractionAt: leads.lastInteractionAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(eq(leads.isDeleted, false))
      .orderBy(desc(leads.lastInteractionAt), desc(leads.updatedAt))
      .limit(80);

    if (recentLeads.length === 0) {
      return NextResponse.json({ ok: true, conversations: [] });
    }

    const leadIds = recentLeads.map((lead) => lead.id);
    const messages = await db
      .select({
        id: conversationMessages.id,
        leadId: conversationMessages.leadId,
        direction: conversationMessages.direction,
        author: conversationMessages.author,
        body: conversationMessages.body,
        messageType: conversationMessages.messageType,
        createdAt: conversationMessages.createdAt,
      })
      .from(conversationMessages)
      .where(and(inArray(conversationMessages.leadId, leadIds), eq(conversationMessages.isDeleted, false)))
      .orderBy(conversationMessages.createdAt);

    const messagesByLead = new Map<string, typeof messages>();
    for (const message of messages) {
      const leadMessages = messagesByLead.get(message.leadId) ?? [];
      leadMessages.push(message);
      messagesByLead.set(message.leadId, leadMessages);
    }

    return NextResponse.json({
      ok: true,
      conversations: recentLeads.map((lead) => {
        const leadMessages = messagesByLead.get(lead.id) ?? [];
        const lastMessage = leadMessages.at(-1);
        const displayName = lead.drivingSchoolName ?? lead.responsibleName ?? lead.pushName ?? lead.phone;

        return {
          id: lead.id,
          name: displayName,
          initials: getInitials(displayName),
          preview: lastMessage?.body ?? "Nova conversa recebida pelo WhatsApp.",
          time: formatRelativeTime(lastMessage?.createdAt ?? lead.lastInteractionAt ?? lead.updatedAt),
          channel: "WhatsApp",
          status: lead.funnelStage,
          aiPaused: lead.aiPaused,
          unread: leadMessages.filter((message) => message.direction === "inbound").length,
          messages: leadMessages.map((message) => ({
            id: message.id,
            author: message.direction === "inbound" ? "lead" : "operator",
            sender: message.direction === "outbound" ? (message.author === "ia" ? "Fausto IA" : "Atendimento") : undefined,
            text: message.body,
            time: formatClock(message.createdAt),
            messageType: message.messageType,
          })),
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar conversas.";
    console.error("[Conversations] Failed to load conversations", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "FX";
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;
  return `${Math.floor(diffHours / 24)} d`;
}
