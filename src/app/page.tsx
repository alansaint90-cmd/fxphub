"use client";

import type { DragEvent, FormEvent } from "react";
import { useState } from "react";

const kanbanStages = [
  { id: "novo", label: "Novo Lead", tone: "neutral" },
  { id: "ia", label: "IA Atendendo", tone: "info" },
  { id: "qualificado", label: "Qualificado", tone: "success" },
  { id: "agendamento", label: "Agendamento", tone: "warning" },
  { id: "nao_qualificado", label: "Nao Qualificado", tone: "danger" },
] as const;

type KanbanStageId = (typeof kanbanStages)[number]["id"];
type AppPage = "dashboard" | "funil" | "conversas" | "agenda" | "integracoes";

const appPages: { id: AppPage; label: string; badge?: number }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "funil", label: "Funil" },
  { id: "conversas", label: "Conversas", badge: 8 },
  { id: "agenda", label: "Agenda" },
  { id: "integracoes", label: "Integracoes" },
];

interface KanbanLead {
  id: string;
  name: string;
  city: string;
  score: number;
  className: "A" | "B" | "C";
  pain: string;
  owner: string;
  stage: KanbanStageId;
}

interface ScheduleSlot {
  id: string;
  day: string;
  date: string;
  time: string;
}

interface Appointment {
  id: string;
  leadId: string;
  leadName: string;
  date: string;
  time: string;
}

const initialKanbanLeads: KanbanLead[] = [
  {
    id: "lead-cfc-catuense",
    name: "CFC Catuense",
    city: "Catu",
    score: 91,
    className: "A",
    pain: "Sem CRM, trafego pago ativo",
    owner: "Fausto",
    stage: "agendamento",
  },
  {
    id: "lead-liberdade",
    name: "Autoescola Liberdade",
    city: "Salvador",
    score: 68,
    className: "B",
    pain: "Equipe pequena, leads perdidos",
    owner: "IA",
    stage: "qualificado",
  },
  {
    id: "lead-direcao-norte",
    name: "Direcao Norte",
    city: "Feira de Santana",
    score: 42,
    className: "C",
    pain: "Baixo volume mensal",
    owner: "Marketing",
    stage: "nao_qualificado",
  },
  {
    id: "lead-cfc-vitoria",
    name: "CFC Vitoria",
    city: "Lauro de Freitas",
    score: 57,
    className: "B",
    pain: "Atendimento manual",
    owner: "Fausto",
    stage: "ia",
  },
  {
    id: "lead-auto-guia",
    name: "Auto Guia",
    city: "Alagoinhas",
    score: 22,
    className: "C",
    pain: "Ainda sem volume claro",
    owner: "IA",
    stage: "novo",
  },
  {
    id: "lead-cfc-atlantico",
    name: "CFC Atlantico",
    city: "Aracaju",
    score: 76,
    className: "A",
    pain: "Baixa conversao",
    owner: "Comercial",
    stage: "qualificado",
  },
];

const leads = [
  {
    name: "CFC Catuense",
    city: "Catu",
    score: 91,
    className: "A",
    status: "Reuniao pronta",
    pain: "Sem CRM, trafego pago ativo",
  },
  {
    name: "Autoescola Liberdade",
    city: "Salvador",
    score: 68,
    className: "B",
    status: "Aguardando horario",
    pain: "Equipe pequena, leads perdidos",
  },
  {
    name: "Direcao Norte",
    city: "Feira de Santana",
    score: 42,
    className: "C",
    status: "Nutrir no CRM",
    pain: "Baixo volume mensal",
  },
];

const messages = [
  {
    author: "lead",
    text: "Tenho uma autoescola com 4 atendentes e uns 40 alunos por mes.",
  },
  {
    author: "ia",
    text: "Perfeito. Voce usa algum CRM para acompanhar esses leads?",
  },
  {
    author: "lead",
    text: "Nao. Hoje fica tudo no WhatsApp e acaba perdendo conversa.",
  },
  {
    author: "ia",
    text: "Entendi. Isso ja mostra uma dor clara de acompanhamento e conversao.",
  },
];

const pains = [
  "Falta de CRM",
  "Leads perdidos",
  "Atendimento manual",
  "Baixa conversao",
  "Demora no atendimento",
];

const scheduleSlots: ScheduleSlot[] = [
  { id: "seg-09", day: "Segunda", date: "29/06", time: "09:00" },
  { id: "seg-11", day: "Segunda", date: "29/06", time: "11:00" },
  { id: "ter-14", day: "Terca", date: "30/06", time: "14:00" },
  { id: "qua-15", day: "Quarta", date: "01/07", time: "15:00" },
  { id: "qui-13", day: "Quinta", date: "02/07", time: "13:00" },
  { id: "qui-18", day: "Quinta", date: "02/07", time: "18:00" },
  { id: "sex-17", day: "Sexta", date: "03/07", time: "17:00" },
  { id: "sex-20", day: "Sexta", date: "03/07", time: "20:00" },
];

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [kanbanLeads, setKanbanLeads] = useState(initialKanbanLeads);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("dashboard");
  const [selectedLeadId, setSelectedLeadId] = useState("lead-cfc-catuense");
  const [selectedSlotId, setSelectedSlotId] = useState("seg-09");
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: "appointment-cfc-catuense",
      leadId: "lead-cfc-catuense",
      leadName: "CFC Catuense",
      date: "29/06",
      time: "09:00",
    },
  ]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError("Informe um e-mail valido.");
      return;
    }

    if (password.length < 6) {
      setLoginError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setLoginError("");
    setIsAuthenticated(true);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, leadId: string) {
    event.dataTransfer.setData("text/plain", leadId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingLeadId(leadId);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event: DragEvent<HTMLElement>, nextStage: KanbanStageId) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/plain") || draggingLeadId;
    if (!leadId) return;

    setKanbanLeads((currentLeads) =>
      currentLeads.map((lead) => (lead.id === leadId ? { ...lead, stage: nextStage } : lead)),
    );
    setDraggingLeadId(null);
  }

  function handleConfirmAppointment() {
    const lead = kanbanLeads.find((currentLead) => currentLead.id === selectedLeadId);
    const slot = scheduleSlots.find((currentSlot) => currentSlot.id === selectedSlotId);
    if (!lead || !slot || lead.className === "C") return;

    setAppointments((currentAppointments) => {
      const withoutSameLead = currentAppointments.filter((appointment) => appointment.leadId !== lead.id);
      return [
        ...withoutSameLead,
        {
          id: `appointment-${lead.id}-${slot.id}`,
          leadId: lead.id,
          leadName: lead.name,
          date: slot.date,
          time: slot.time,
        },
      ];
    });

    setKanbanLeads((currentLeads) =>
      currentLeads.map((currentLead) =>
        currentLead.id === lead.id ? { ...currentLead, stage: "agendamento" } : currentLead,
      ),
    );
  }

  const schedulableLeads = kanbanLeads.filter((lead) => lead.className === "A" || lead.className === "B");
  const selectedLead = schedulableLeads.find((lead) => lead.id === selectedLeadId) ?? schedulableLeads[0];
  const selectedSlot = scheduleSlots.find((slot) => slot.id === selectedSlotId) ?? scheduleSlots[0];
  const occupiedSlotIds = new Set(
    appointments
      .filter((appointment) => appointment.leadId !== selectedLead?.id)
      .map((appointment) => {
        const slot = scheduleSlots.find(
          (currentSlot) => currentSlot.date === appointment.date && currentSlot.time === appointment.time,
        );
        return slot?.id;
      })
      .filter(Boolean),
  );

  if (!isAuthenticated) {
    return (
      <main className="login-screen">
        <section className="login-panel" aria-label="Acesso ao Fausto IA">
          <div className="brand login-brand">
            <div className="brand-mark">F</div>
            <div>
              <strong>Fausto IA</strong>
              <span>Auto Pro IA CRM</span>
            </div>
          </div>

          <div className="login-copy">
            <span className="eyebrow">Acesso comercial</span>
            <h1>Entre na central de qualificacao</h1>
            <p>Monitore leads, score, conversas e agenda comercial em um unico painel.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              <span>E-mail</span>
              <input name="email" type="email" placeholder="operador@faustoia.com" autoComplete="email" />
            </label>

            <label>
              <span>Senha</span>
              <input name="password" type="password" placeholder="Digite sua senha" autoComplete="current-password" />
            </label>

            {loginError ? <p className="form-error">{loginError}</p> : null}

            <button type="submit">Entrar</button>
          </form>
        </section>

        <aside className="login-preview" aria-label="Resumo operacional">
          <div className="preview-top">
            <span className="pulse" />
            <strong>IA ativa</strong>
          </div>

          <div className="preview-score">
            <span>Score A</span>
            <strong>91</strong>
            <small>CFC Catuense pronto para reuniao</small>
          </div>

          <div className="preview-stack">
            <div>
              <span>Qualificados hoje</span>
              <strong>23</strong>
            </div>
            <div>
              <span>Agenda protegida</span>
              <strong>9h</strong>
            </div>
          </div>
        </aside>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>Fausto IA</strong>
            <span>Pre-qualificacao</span>
          </div>
        </div>

        <nav className="nav-list">
          {appPages.map((page) => (
            <button
              className={`nav-item ${activePage === page.id ? "active" : ""}`}
              key={page.id}
              type="button"
              onClick={() => setActivePage(page.id)}
            >
              <span>{page.label}</span>
              {page.badge ? <b>{page.badge}</b> : null}
            </button>
          ))}
        </nav>

        <div className="ai-card">
          <span className="pulse" />
          <strong>IA ativa</strong>
          <p>Evolution, OpenAI, Redis e Postgres prontos para conectar.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Auto Pro IA CRM</span>
            <h1>Central de qualificacao comercial</h1>
          </div>
          <div className="top-actions">
            <label className="search">
              <span>Buscar</span>
              <input placeholder="Lead, telefone ou cidade" />
            </label>
            <button type="button">Novo lead</button>
            <button className="secondary" type="button" onClick={() => setIsAuthenticated(false)}>
              Sair
            </button>
          </div>
        </header>

        <section id="dashboard" className={`hero-grid ${activePage === "dashboard" ? "" : "page-hidden"}`}>
          <article className="command-panel">
            <div className="panel-heading">
              <span className="eyebrow">Operacao em tempo real</span>
              <h2>Fausto filtra curiosos antes da agenda comercial</h2>
            </div>
            <p>
              A IA registra cada resposta, recalcula score, identifica dores e so libera reuniao
              para leads classificados como A ou B.
            </p>

            <div className="metric-grid">
              <div className="metric">
                <span>Leads hoje</span>
                <strong>77</strong>
                <small>+18% vs. ontem</small>
              </div>
              <div className="metric">
                <span>Qualificados</span>
                <strong>23</strong>
                <small>A/B prontos</small>
              </div>
              <div className="metric">
                <span>Agenda salva</span>
                <strong>9h</strong>
                <small>Curiosos barrados</small>
              </div>
            </div>
          </article>

          <article className="score-panel">
            <div className="score-ring">
              <span>91</span>
              <small>Score A</small>
            </div>
            <h2>CFC Catuense</h2>
            <p>4 atendentes, media de 40 matriculas por mes, sem CRM e com trafego pago ativo.</p>
            <div className="tag-row">
              <span>Cliente ideal</span>
              <span>Agendar</span>
            </div>
          </article>
        </section>

        <section id="funil" className={`kanban-panel ${activePage === "funil" ? "" : "page-hidden"}`}>
          <div className="section-title kanban-title">
            <div>
              <span className="eyebrow">Funil operacional</span>
              <h2>Kanban de qualificacao</h2>
            </div>
            <span>{kanbanLeads.length} leads em acompanhamento</span>
          </div>

          <div className="kanban-board" aria-label="Quadro Kanban do funil">
            {kanbanStages.map((stage) => {
              const stageLeads = kanbanLeads.filter((lead) => lead.stage === stage.id);

              return (
                <article
                  className={`kanban-column ${stage.tone}`}
                  key={stage.id}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(event, stage.id)}
                >
                  <header className="kanban-column-header">
                    <span>{stage.label}</span>
                    <b>{stageLeads.length}</b>
                  </header>

                  <div className="kanban-card-list">
                    {stageLeads.map((lead) => (
                      <article
                        className={`kanban-card ${draggingLeadId === lead.id ? "dragging" : ""}`}
                        draggable
                        key={lead.id}
                        onDragEnd={() => setDraggingLeadId(null)}
                        onDragStart={(event) => handleDragStart(event, lead.id)}
                      >
                        <div className="kanban-card-top">
                          <strong>{lead.name}</strong>
                          <b className={`class-badge grade-${lead.className.toLowerCase()}`}>{lead.className}</b>
                        </div>
                        <span>{lead.city}</span>
                        <p>{lead.pain}</p>
                        <div className="kanban-card-footer">
                          <small>Score {lead.score}</small>
                          <small>{lead.owner}</small>
                        </div>
                      </article>
                    ))}

                    {stageLeads.length === 0 ? <div className="kanban-empty">Solte um lead aqui</div> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="content-grid">
          <article className={`panel lead-table ${activePage === "dashboard" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">CRM</span>
              <h2>Leads priorizados</h2>
            </div>
            <div className="table-head">
              <span>Lead</span>
              <span>Score</span>
              <span>Status</span>
            </div>
            {leads.map((lead) => (
              <div className="lead-row" key={lead.name}>
                <div>
                  <strong>{lead.name}</strong>
                  <span>{lead.city} - {lead.pain}</span>
                </div>
                <b className={`class-badge grade-${lead.className.toLowerCase()}`}>{lead.className}</b>
                <span>{lead.status}</span>
              </div>
            ))}
          </article>

          <article id="conversas" className={`panel conversation ${activePage === "conversas" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">WhatsApp</span>
              <h2>Conversa assistida</h2>
            </div>
            <div className="chat-window">
              {messages.map((message) => (
                <p className={`bubble ${message.author}`} key={message.text}>
                  {message.text}
                </p>
              ))}
            </div>
            <div className="control-row">
              <button type="button">Assumir</button>
              <button className="secondary" type="button">Pausar IA</button>
            </div>
          </article>

          <article className={`panel diagnostic ${activePage === "dashboard" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">Diagnostico</span>
              <h2>Dores detectadas</h2>
            </div>
            <div className="pain-list">
              {pains.map((pain) => (
                <span key={pain}>{pain}</span>
              ))}
            </div>
            <p>
              Resumo automatico salvo no CRM com contexto operacional, volume, equipe,
              maturidade comercial e proximos passos.
            </p>
          </article>

          <article id="agenda" className={`panel agenda-panel ${activePage === "agenda" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">Agenda comercial</span>
              <h2>Horarios disponiveis</h2>
            </div>

            <label className="agenda-select">
              <span>Lead qualificado</span>
              <select value={selectedLead?.id} onChange={(event) => setSelectedLeadId(event.target.value)}>
                {schedulableLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} - Score {lead.score}
                  </option>
                ))}
              </select>
            </label>

            <div className="slot-grid" aria-label="Horarios disponiveis para reuniao">
              {scheduleSlots.map((slot) => {
                const isSelected = selectedSlot?.id === slot.id;
                const isOccupied = occupiedSlotIds.has(slot.id);

                return (
                  <button
                    className={`slot-button ${isSelected ? "selected" : ""}`}
                    disabled={isOccupied}
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                  >
                    <span>{slot.day}</span>
                    <strong>{slot.time}</strong>
                    <small>{isOccupied ? "Ocupado" : slot.date}</small>
                  </button>
                );
              })}
            </div>

            <div className="agenda-summary">
              <div>
                <span>Selecionado</span>
                <strong>
                  {selectedLead?.name} - {selectedSlot?.date} as {selectedSlot?.time}
                </strong>
              </div>
              <button type="button" onClick={handleConfirmAppointment}>
                Confirmar reuniao
              </button>
            </div>

            <div className="appointment-list">
              <span className="eyebrow">Reunioes marcadas</span>
              {appointments.map((appointment) => (
                <div className="appointment-row" key={appointment.id}>
                  <div>
                    <strong>{appointment.leadName}</strong>
                    <span>{appointment.date} as {appointment.time}</span>
                  </div>
                  <b>Confirmada</b>
                </div>
              ))}
            </div>
          </article>

          <article className={`panel integrations-panel ${activePage === "integracoes" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">Conexoes</span>
              <h2>Integracoes do sistema</h2>
            </div>

            <div className="integration-list">
              {[
                ["WhatsApp", "Evolution API", "Ativo"],
                ["IA", "OpenAI API", "Pronto"],
                ["Memoria", "Redis", "Configurado"],
                ["CRM", "PostgreSQL e Supabase", "Conectavel"],
              ].map(([name, detail, status]) => (
                <div className="integration-row" key={name}>
                  <div>
                    <strong>{name}</strong>
                    <span>{detail}</span>
                  </div>
                  <b>{status}</b>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
