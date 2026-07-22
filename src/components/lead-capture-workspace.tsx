"use client";

import { useEffect, useMemo, useState } from "react";

type CaptureTab = "overview" | "qualified" | "unqualified" | "all" | "form" | "rules" | "tracking";

interface CaptureLead {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  monthlyEnrollments: number;
  salesAttendants: number;
  usesCrm?: string | null;
  runsPaidAds?: string | null;
  monthlyAdSpend?: number | null;
  mainChallenge?: string | null;
  meetingInterest: string;
  qualificationScore: number;
  qualificationStatus: "qualified" | "unqualified";
  disqualificationReason?: string | null;
  leadStatus: string;
  whatsappClicked: boolean;
  faustoContactStarted: boolean;
  meetingScheduled: boolean;
  meetingDate?: string | null;
  source?: string | null;
  utmCampaign?: string | null;
  tags: string[];
  notes?: string | null;
  diagnosticAnswers: Record<string, unknown>;
  createdAt: string;
}

interface CaptureSettings {
  slug: string;
  formName: string;
  title: string;
  isActive: boolean;
  whatsappNumber?: string | null;
  qualifiedMinScore: number;
  metaPixelId?: string | null;
}

interface CaptureEvent {
  eventName: string;
  createdAt: string;
}

const LEAD_CAPTURE_RESET_AT = new Date("2026-07-22T01:22:21-03:00").getTime();
const funnelQuestions = [
  { key: "nome", label: "Nome do responsavel" },
  { key: "empresa", label: "Nome da autoescola" },
  { key: "cargo", label: "Cargo na empresa" },
  { key: "trafegoPago", label: "Uso de trafego pago" },
  { key: "leadsAtuais", label: "Leads atuais" },
  { key: "leadsDesejados", label: "Meta de leads" },
  { key: "estruturaAtendimento", label: "Estrutura de atendimento" },
  { key: "tempoResposta", label: "Tempo de resposta" },
  { key: "principalDesafio", label: "Principal desafio" },
  { key: "aberturaNovaEstrategia", label: "Abertura para estrategia" },
  { key: "interesseReuniao", label: "Interesse em reuniao" },
];

export function LeadCaptureWorkspace() {
  const [activeTab, setActiveTab] = useState<CaptureTab>("overview");
  const [leads, setLeads] = useState<CaptureLead[]>([]);
  const [events, setEvents] = useState<CaptureEvent[]>([]);
  const [settings, setSettings] = useState<CaptureSettings | null>(null);
  const [status, setStatus] = useState("Carregando captacao...");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadLeads();
  }, []);

  async function loadLeads() {
    try {
      const response = await fetch("/api/lead-capture/leads", { cache: "no-store" });
      const result = (await response.json()) as { ok?: boolean; leads?: CaptureLead[]; events?: CaptureEvent[]; settings?: CaptureSettings | null; error?: string };
      if (!result.ok) {
        setStatus(result.error ?? "Nao foi possivel carregar.");
        return;
      }
      setLeads(result.leads ?? []);
      setEvents(result.events ?? []);
      setSettings(result.settings ?? null);
      setStatus("");
    } catch {
      setStatus("Erro ao carregar captacao.");
    }
  }

  async function updateLead(id: string, action: string, qualificationStatus?: "qualified" | "unqualified") {
    await fetch("/api/lead-capture/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, qualificationStatus }),
    });
    await loadLeads();
  }

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return leads.filter((lead) => [lead.name, lead.businessName, lead.phone, lead.email, lead.city, lead.utmCampaign]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query));
  }, [leads, search]);
  const visibleLeads = leads.filter((lead) => new Date(lead.createdAt).getTime() >= LEAD_CAPTURE_RESET_AT);
  const visibleEvents = events.filter((event) => new Date(event.createdAt).getTime() >= LEAD_CAPTURE_RESET_AT);
  const filteredVisible = filtered.filter((lead) => new Date(lead.createdAt).getTime() >= LEAD_CAPTURE_RESET_AT);
  const qualified = filteredVisible.filter((lead) => lead.qualificationStatus === "qualified");
  const unqualified = filteredVisible.filter((lead) => lead.qualificationStatus === "unqualified");
  const defaultSlug = settings?.slug || "diagnostico-autoescola";
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/formulario/${defaultSlug}`;
  const todayCount = visibleLeads.filter((lead) => new Date(lead.createdAt).toDateString() === new Date().toDateString()).length;
  const qualificationRate = visibleLeads.length ? Math.round((visibleLeads.filter((lead) => lead.qualificationStatus === "qualified").length / visibleLeads.length) * 100) : 0;
  const whatsappClickedCount = visibleLeads.filter((lead) => lead.whatsappClicked).length;
  const scheduledCount = visibleLeads.filter((lead) => lead.meetingScheduled).length;
  const lastSevenDaysCount = visibleLeads.filter((lead) => daysAgo(lead.createdAt) <= 7).length;
  const lastThirtyDaysCount = visibleLeads.filter((lead) => daysAgo(lead.createdAt) <= 30).length;
  const recentLeads = filteredVisible.slice(0, 6);
  const formEntryCount = Math.max(visibleEvents.filter((event) => event.eventName === "PageView").length, visibleLeads.length);
  const funnelSteps = [
    { label: "Entraram no formulario", value: formEntryCount },
    ...funnelQuestions.map((question) => ({
      label: question.label,
      value: visibleLeads.filter((lead) => hasDiagnosticAnswer(lead, question.key)).length,
    })),
    { label: "Formulario concluido", value: visibleLeads.length },
    { label: "Clicaram no WhatsApp", value: whatsappClickedCount },
  ];

  return (
    <article className="panel lead-capture-panel">
      <header className="lead-capture-header">
        <div>
          <span className="eyebrow">Captacao de Leads</span>
          <h2>Formularios de anuncios e pre-qualificacao</h2>
        </div>
        <label className="lead-capture-search">
          <span>Buscar</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, campanha..." />
        </label>
      </header>

      <section className="lead-capture-command">
        <div className="capture-command-main">
          <span>Pipeline dos formularios</span>
          <strong>{visibleLeads.length}</strong>
          <small>leads recebidos no diagnostico</small>
        </div>
        <div className="capture-command-grid">
          <div>
            <span>Qualificados</span>
            <strong>{qualified.length}</strong>
          </div>
          <div>
            <span>WhatsApp</span>
            <strong>{whatsappClickedCount}</strong>
          </div>
          <div>
            <span>Reunioes</span>
            <strong>{scheduledCount}</strong>
          </div>
          <div>
            <span>Hoje</span>
            <strong>{todayCount}</strong>
          </div>
        </div>
      </section>

      <nav className="lead-capture-tabs">
        {[
          ["overview", "Visao Geral"],
          ["qualified", "Leads Qualificados"],
          ["unqualified", "Leads Nao Qualificados"],
          ["all", "Todos os Leads"],
          ["form", "Configuracao do Formulario"],
          ["rules", "Configuracao da Qualificacao"],
          ["tracking", "Integracoes e Rastreamento"],
        ].map(([id, label]) => (
          <button className={activeTab === id ? "active" : ""} key={id} type="button" onClick={() => setActiveTab(id as CaptureTab)}>
            {label}
          </button>
        ))}
      </nav>

      {status ? <p className="integration-status">{status}</p> : null}

      {activeTab === "overview" ? (
        <section className="capture-overview-layout">
          <div className="capture-overview">
            {[
              ["Total iniciados", visibleLeads.length],
              ["Formularios concluidos", visibleLeads.length],
              ["Qualificados", qualified.length],
              ["Nao qualificados", unqualified.length],
              ["Taxa qualificacao", `${qualificationRate}%`],
              ["Clicaram WhatsApp", whatsappClickedCount],
              ["Nao clicaram WhatsApp", visibleLeads.length - whatsappClickedCount],
              ["Reuniao agendada", scheduledCount],
              ["Captados hoje", todayCount],
              ["Ultimos 7 dias", lastSevenDaysCount],
              ["Ultimos 30 dias", lastThirtyDaysCount],
              ["Campanhas ativas", settings?.isActive ? 1 : 0],
            ].map(([label, value]) => (
              <div className="executive-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <aside className="capture-live-panel">
            <header>
              <span className="eyebrow">Entrada recente</span>
              <h3>Novos diagnosticos</h3>
            </header>
            <div className="capture-live-list">
              {recentLeads.map((lead) => (
                <article key={lead.id}>
                  <div>
                    <strong>{lead.businessName}</strong>
                    <span>{lead.name} | {lead.city || "Cidade nao informada"}</span>
                  </div>
                  <b>{lead.qualificationStatus === "qualified" ? "Qualificado" : "Nao qualificado"}</b>
                </article>
              ))}
              {recentLeads.length === 0 ? <p>Nenhum lead recebido ainda.</p> : null}
            </div>
          </aside>
        </section>
      ) : null}

      {activeTab === "qualified" ? <LeadTable leads={qualified} onAction={updateLead} /> : null}
      {activeTab === "unqualified" ? <LeadTable leads={unqualified} onAction={updateLead} /> : null}
      {activeTab === "all" ? <LeadTable leads={filteredVisible} onAction={updateLead} /> : null}

      {activeTab === "form" ? (
        <section className="capture-config-grid">
          <div className="capture-config-card">
            <h3>Link publico</h3>
            <input readOnly value={publicUrl} />
            <div className="capture-actions">
              <button type="button" onClick={() => navigator.clipboard?.writeText(publicUrl)}>Copiar link</button>
              <a href={publicUrl} target="_blank">Abrir formulario</a>
            </div>
            <div className="capture-public-preview">
              <span>Formulario interativo em 5 etapas</span>
              <strong>{settings?.title || "Diagnostico comercial para autoescolas"}</strong>
              <small>Use este link em anuncios, bio, WhatsApp ou QR Code.</small>
            </div>
          </div>
          <div className="capture-config-card">
            <h3>Status</h3>
            <span>{settings?.isActive ? "Formulario ativo" : "Formulario aguardando configuracao"}</span>
            <span>Score minimo: {settings?.qualifiedMinScore ?? 50}</span>
            <span>WhatsApp: {settings?.whatsappNumber || "Nao configurado"}</span>
            <div className="capture-qr" aria-label="QR Code visual do formulario">
              <i /><i /><i /><i /><i /><i /><i /><i /><i />
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "rules" ? (
        <section className="capture-config-card">
          <h3>Regra atual de qualificacao</h3>
          <p>Lead qualificado exige score minimo de {settings?.qualifiedMinScore ?? 50}, telefone valido, autoescola ativa e interesse real em reuniao.</p>
          <p>Os pesos iniciais consideram matriculas, atendentes, CRM, trafego pago, dor comercial e interesse em reuniao.</p>
        </section>
      ) : null}

      {activeTab === "tracking" ? (
        <section className="capture-tracking-layout">
          <div className="capture-config-card">
            <h3>Meta Pixel e rastreamento</h3>
            <p>Pixel ID: {settings?.metaPixelId || "Nao configurado"}</p>
            <p>Eventos preparados: PageView, Lead, QualifiedLead, UnqualifiedLead e Contact.</p>
          </div>
          <aside className="capture-funnel-card">
            <header>
              <span className="eyebrow">Funil do formulario</span>
              <h3>Passagem por pergunta</h3>
            </header>
            <div className="capture-funnel-list">
              {funnelSteps.map((step) => (
                <div className="capture-funnel-step" key={step.label}>
                  <div>
                    <span>{step.label}</span>
                    <strong>{step.value}</strong>
                  </div>
                  <i>
                    <b style={{ width: `${toPercent(step.value, formEntryCount)}%` }} />
                  </i>
                  <small>{toPercent(step.value, formEntryCount)}%</small>
                </div>
              ))}
            </div>
          </aside>
        </section>
      ) : null}
    </article>
  );
}

function LeadTable({ leads, onAction }: { leads: CaptureLead[]; onAction: (id: string, action: string, qualificationStatus?: "qualified" | "unqualified") => void }) {
  return (
    <div className="capture-table">
      <div className="capture-table-head">
        <span>Lead</span><span>Autoescola</span><span>WhatsApp</span><span>Cidade</span><span>Score</span><span>Status</span><span>Campanha</span><span>Acoes</span>
      </div>
      {leads.map((lead) => (
        <article className="capture-row" key={lead.id}>
          <div><strong>{lead.name}</strong><small>{lead.email || "Sem e-mail"}</small></div>
          <span>{lead.businessName}</span>
          <span>{lead.phone}</span>
          <span>{lead.city}/{lead.state}</span>
          <b>{lead.qualificationScore}</b>
          <span>{lead.leadStatus}</span>
          <span>{lead.utmCampaign || lead.source || "Formulario"}</span>
          <div className="capture-row-actions">
            <button type="button" onClick={() => onAction(lead.id, "mark_scheduled")}>Agendado</button>
            <button type="button" onClick={() => onAction(lead.id, "mark_closed")}>Fechado</button>
            <button type="button" onClick={() => onAction(lead.id, "reclassify", lead.qualificationStatus === "qualified" ? "unqualified" : "qualified")}>Reclassificar</button>
          </div>
        </article>
      ))}
      {leads.length === 0 ? <div className="clients-empty-state">Nenhum lead encontrado</div> : null}
    </div>
  );
}

function daysAgo(value: string) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function hasDiagnosticAnswer(lead: CaptureLead, key: string) {
  const value = lead.diagnosticAnswers?.[key];
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function toPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}
