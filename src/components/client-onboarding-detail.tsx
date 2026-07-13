"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { clientFormTemplates, onboardingChecklistTemplate } from "@/lib/onboarding/defaults";

type ClientDetailTab = "overview" | "implementation" | "forms" | "trainings" | "history" | "documents" | "pending";

interface ClientDetailResponse {
  ok?: boolean;
  error?: string;
  client?: ActiveClientDetail;
  onboarding?: ClientOnboarding;
  checklist?: ChecklistItem[];
  forms?: ClientFormRecord[];
  trainings?: TrainingRecord[];
  documents?: DocumentRecord[];
  notes?: NoteRecord[];
  history?: HistoryRecord[];
  pendingItems?: PendingRecord[];
  qualityChecks?: QualityRecord[];
  acceptanceTerms?: AcceptanceRecord[];
}

interface ActiveClientDetail {
  id: string;
  companyName: string;
  responsibleName: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  stage: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientOnboarding {
  id: string;
  planName?: string | null;
  internalOwnerName?: string | null;
  status: string;
  health: string;
  contractedAt?: string | null;
  onboardingStartedAt?: string | null;
  plannedCompletionAt?: string | null;
  completedAt?: string | null;
  progress: number;
  nextRecommendedAction?: string | null;
  metrics: Record<string, unknown>;
}

interface ChecklistItem {
  id: string;
  stageKey: string;
  stageName: string;
  label: string;
  isCompleted: boolean;
  isBlocked: boolean;
  responsibleName?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  documentUrl?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  blockReason?: string | null;
}

interface ClientFormRecord {
  id: string;
  formType: string;
  data: Record<string, unknown>;
  completionPercent: number;
  lastEditedBy?: string | null;
  updatedAt: string;
}

interface TrainingRecord {
  id: string;
  title: string;
  type: string;
  scheduledAt?: string | null;
  status: string;
  fxpOwnerName?: string | null;
  participants?: string | null;
  contentCovered?: string | null;
  notes?: string | null;
}

interface DocumentRecord {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  fileUrl?: string | null;
  createdAt: string;
}

interface NoteRecord {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

interface HistoryRecord {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

interface PendingRecord {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  responsibleName?: string | null;
  priority: string;
  dueAt?: string | null;
  status: string;
  notes?: string | null;
}

interface QualityRecord {
  id: string;
  label: string;
  isCompleted: boolean;
  isRequired: boolean;
  exceptionJustification?: string | null;
}

interface AcceptanceRecord {
  id: string;
  clientName: string;
  responsibleName: string;
  acceptedAt?: string | null;
  clientConfirmation: boolean;
  signedTermUrl?: string | null;
}

const tabs: { id: ClientDetailTab; label: string }[] = [
  { id: "overview", label: "Visao Geral" },
  { id: "implementation", label: "Implantacao" },
  { id: "forms", label: "Formularios" },
  { id: "trainings", label: "Treinamentos" },
  { id: "history", label: "Historico" },
  { id: "documents", label: "Documentos" },
  { id: "pending", label: "Pendencias" },
];

export function ClientOnboardingDetail({ clientId }: { clientId: string }) {
  const [activeTab, setActiveTab] = useState<ClientDetailTab>("overview");
  const [data, setData] = useState<ClientDetailResponse | null>(null);
  const [status, setStatus] = useState("Carregando cliente...");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    void loadClient();
  }, [clientId]);

  async function loadClient() {
    setStatus("Carregando cliente...");
    try {
      const response = await fetch(`/api/active-clients/${clientId}`, { cache: "no-store" });
      const result = (await response.json()) as ClientDetailResponse;
      if (!result.ok) {
        setStatus(result.error ?? "Nao foi possivel carregar cliente.");
        return;
      }
      setData(result);
      setStatus("");
    } catch {
      setStatus("Erro ao carregar cliente.");
    }
  }

  async function saveAction(body: Record<string, unknown>, savingKey = "saving") {
    setSavingId(savingKey);
    try {
      const response = await fetch(`/api/client-onboarding/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!result.ok) {
        setStatus(result.error ?? "Nao foi possivel salvar.");
        return;
      }
      await loadClient();
      setStatus("Alteracao salva.");
    } catch {
      setStatus("Erro ao salvar.");
    } finally {
      setSavingId("");
    }
  }

  const checklist = data?.checklist ?? [];
  const onboarding = data?.onboarding ?? null;
  const client = data?.client ?? null;
  const pendingItems = data?.pendingItems ?? [];
  const qualityChecks = data?.qualityChecks ?? [];
  const forms = data?.forms ?? [];
  const trainings = data?.trainings ?? [];
  const documents = data?.documents ?? [];
  const notes = data?.notes ?? [];
  const history = data?.history ?? [];
  const criticalPending = pendingItems.filter((item) => item.priority === "Critica" && item.status !== "Resolvida");
  const stats = useMemo(() => buildStats(checklist, onboarding, pendingItems), [checklist, onboarding, pendingItems]);
  const bottlenecks = useMemo(() => buildBottlenecks(checklist, onboarding, pendingItems), [checklist, onboarding, pendingItems]);

  if (!client || !onboarding) {
    return (
      <main className="client-page-shell">
        <Link href="/" className="client-back-link">Voltar para o FXP Hub</Link>
        <section className="client-detail-loading">{status}</section>
      </main>
    );
  }

  return (
    <main className="client-page-shell">
      <header className="client-page-header">
        <Link href="/" className="client-back-link">Voltar para clientes</Link>
        <div className="client-header-card">
          <div>
            <span className="eyebrow">Area individual do cliente</span>
            <h1>{client.companyName}</h1>
            <p>{client.responsibleName} | {client.phone || "Telefone nao informado"} | {client.email || "E-mail nao informado"}</p>
          </div>
          <div className="client-header-progress">
            <strong>{onboarding.progress}%</strong>
            <span>Onboarding</span>
            <div className="progress-line"><i style={{ width: `${onboarding.progress}%` }} /></div>
          </div>
        </div>

        {criticalPending.length > 0 ? (
          <div className="client-critical-alert">
            Existem {criticalPending.length} pendencias criticas abertas neste cliente.
          </div>
        ) : null}

        <div className="client-info-grid">
          <Info label="Plano contratado" value={onboarding.planName || "Nao informado"} />
          <Info label="Responsavel FXP" value={onboarding.internalOwnerName || "Nao definido"} />
          <Info label="Data da contratacao" value={formatDate(onboarding.contractedAt ?? client.createdAt)} />
          <Info label="Prazo previsto" value={formatDate(onboarding.plannedCompletionAt)} />
          <Info label="Status geral" value={onboarding.status} />
          <Info label="Saude do cliente" value={onboarding.health} />
        </div>

        <div className="client-quick-actions">
          <button type="button" onClick={() => setActiveTab("forms")}>Editar cliente</button>
          <button type="button" onClick={() => setActiveTab("history")}>Registrar contato</button>
          <button type="button" onClick={() => setActiveTab("pending")}>Criar tarefa</button>
          <button type="button" onClick={() => setActiveTab("history")}>Adicionar observacao</button>
          <button type="button" onClick={() => setActiveTab("trainings")}>Agendar treinamento</button>
          <button
            className="secondary"
            type="button"
            onClick={() =>
              saveAction({ action: "update_status", onboardingId: onboarding.id, status: "Concluida" }, "complete")
            }
          >
            Marcar implantacao como concluida
          </button>
        </div>
      </header>

      <nav className="client-tabs">
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? "active" : ""} key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {status ? <p className="client-save-status">{status}</p> : null}

      {activeTab === "overview" ? (
        <OverviewTab
          bottlenecks={bottlenecks}
          checklist={checklist}
          onboarding={onboarding}
          pendingItems={pendingItems}
          qualityChecks={qualityChecks}
          stats={stats}
        />
      ) : null}

      {activeTab === "implementation" ? (
        <ImplementationTab checklist={checklist} onSave={saveAction} savingId={savingId} />
      ) : null}

      {activeTab === "forms" ? (
        <FormsTab forms={forms} onSave={saveAction} />
      ) : null}

      {activeTab === "trainings" ? (
        <TrainingsTab onboardingId={onboarding.id} trainings={trainings} onSave={saveAction} />
      ) : null}

      {activeTab === "history" ? (
        <HistoryTab history={history} notes={notes} onSave={saveAction} />
      ) : null}

      {activeTab === "documents" ? (
        <DocumentsTab documents={documents} onSave={saveAction} />
      ) : null}

      {activeTab === "pending" ? (
        <PendingTab onboardingId={onboarding.id} pendingItems={pendingItems} onSave={saveAction} />
      ) : null}
    </main>
  );
}

function OverviewTab({
  bottlenecks,
  checklist,
  onboarding,
  pendingItems,
  qualityChecks,
  stats,
}: {
  bottlenecks: ReturnType<typeof buildBottlenecks>;
  checklist: ChecklistItem[];
  onboarding: ClientOnboarding;
  pendingItems: PendingRecord[];
  qualityChecks: QualityRecord[];
  stats: ReturnType<typeof buildStats>;
}) {
  const firstTrainingDone = checklist.some((item) => item.stageKey === "treinamento" && item.isCompleted);
  const whatsappConnected = checklist.some((item) => item.label === "WhatsApp conectado" && item.isCompleted);
  const iaConfigured = checklist.some((item) => item.stageKey === "ia" && item.isCompleted);
  const crmConfigured = checklist.some((item) => item.label === "Funil do CRM configurado" && item.isCompleted);

  return (
    <section className="client-tab-panel">
      <div className="client-summary-grid">
        <Info label="Status da implantacao" value={onboarding.status} />
        <Info label="Progresso geral" value={`${onboarding.progress}%`} />
        <Info label="Dias em implantacao" value={`${stats.elapsedDays}`} />
        <Info label="Data de inicio" value={formatDate(onboarding.onboardingStartedAt)} />
        <Info label="Prazo previsto" value={formatDate(onboarding.plannedCompletionAt)} />
        <Info label="Tarefas pendentes" value={`${stats.pending}`} />
        <Info label="Pendencias criticas" value={`${pendingItems.filter((item) => item.priority === "Critica").length}`} />
        <Info label="Ultimo contato" value={stats.lastContact} />
        <Info label="Proximo contato" value={stats.nextContact} />
        <Info label="Treinamento realizado" value={firstTrainingDone ? "Sim" : "Nao"} />
        <Info label="WhatsApp conectado" value={whatsappConnected ? "Sim" : "Nao"} />
        <Info label="IA configurada" value={iaConfigured ? "Sim" : "Nao"} />
        <Info label="CRM configurado" value={crmConfigured ? "Sim" : "Nao"} />
      </div>

      <section className="client-recommendation">
        <span className="eyebrow">Proxima acao recomendada</span>
        <h2>{onboarding.nextRecommendedAction || "Validar proximos passos da implantacao."}</h2>
      </section>

      <section className="client-bottlenecks">
        <span className="eyebrow">Gargalos identificados</span>
        {bottlenecks.length === 0 ? <p>Nenhum gargalo critico identificado agora.</p> : null}
        {bottlenecks.map((item) => (
          <article key={item.problem}>
            <strong>{item.problem}</strong>
            <span>Impacto: {item.impact}</span>
            <span>Responsavel: {item.owner}</span>
            <span>Tempo parado: {item.stoppedTime}</span>
            <p>{item.action}</p>
          </article>
        ))}
      </section>

      <section className="client-quality-panel">
        <span className="eyebrow">Controle de Qualidade</span>
        <div className="quality-grid">
          {qualityChecks.map((item) => (
            <span className={item.isCompleted ? "done" : ""} key={item.id}>
              {item.isCompleted ? "OK" : "Pendente"} - {item.label}
            </span>
          ))}
        </div>
      </section>
    </section>
  );
}

function ImplementationTab({
  checklist,
  onSave,
  savingId,
}: {
  checklist: ChecklistItem[];
  onSave: (body: Record<string, unknown>, savingKey?: string) => Promise<void>;
  savingId: string;
}) {
  return (
    <section className="client-tab-panel">
      {onboardingChecklistTemplate.map((stage) => {
        const items = checklist.filter((item) => item.stageKey === stage.key);
        const completed = items.filter((item) => item.isCompleted).length;
        const progress = items.length ? Math.round((completed / items.length) * 100) : 0;

        return (
          <article className="onboarding-stage-card" key={stage.key}>
            <header>
              <div>
                <span className="eyebrow">Etapa</span>
                <h2>{stage.name}</h2>
              </div>
              <strong>{progress}%</strong>
            </header>
            <div className="progress-line"><i style={{ width: `${progress}%` }} /></div>
            <div className="checklist-item-list">
              {items.map((item) => (
                <article className={`checklist-item ${item.isBlocked ? "blocked" : ""}`} key={item.id}>
                  <label>
                    <input
                      checked={item.isCompleted}
                      disabled={savingId === item.id}
                      type="checkbox"
                      onChange={(event) =>
                        onSave({ action: "update_checklist_item", itemId: item.id, isCompleted: event.target.checked }, item.id)
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                  <div className="checklist-controls">
                    <input
                      defaultValue={item.responsibleName ?? ""}
                      placeholder="Responsavel"
                      onBlur={(event) =>
                        onSave({ action: "update_checklist_item", itemId: item.id, responsibleName: event.target.value }, item.id)
                      }
                    />
                    <input
                      defaultValue={toDateInput(item.dueAt)}
                      type="date"
                      onBlur={(event) =>
                        onSave({ action: "update_checklist_item", itemId: item.id, dueAt: dateToIso(event.target.value) }, item.id)
                      }
                    />
                    <input
                      defaultValue={item.notes ?? ""}
                      placeholder="Observacao"
                      onBlur={(event) =>
                        onSave({ action: "update_checklist_item", itemId: item.id, notes: event.target.value }, item.id)
                      }
                    />
                    <button
                      className={item.isBlocked ? "danger" : "secondary"}
                      type="button"
                      onClick={() =>
                        onSave(
                          {
                            action: "update_checklist_item",
                            itemId: item.id,
                            isBlocked: !item.isBlocked,
                            blockReason: item.isBlocked ? "" : "Bloqueado para analise",
                          },
                          item.id,
                        )
                      }
                    >
                      {item.isBlocked ? "Desbloquear" : "Bloquear"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function FormsTab({ forms, onSave }: { forms: ClientFormRecord[]; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  return (
    <section className="client-tab-panel forms-panel">
      {clientFormTemplates.map((template) => {
        const form = forms.find((item) => item.formType === template.type);
        if (!form) return null;
        return <ClientDynamicForm form={form} key={template.type} template={template} onSave={onSave} />;
      })}
    </section>
  );
}

function ClientDynamicForm({
  form,
  template,
  onSave,
}: {
  form: ClientFormRecord;
  template: (typeof clientFormTemplates)[number];
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(template.fields.map((field) => [field, String(formData.get(field) ?? "").trim()]));
    const filled = Object.values(data).filter(Boolean).length;
    const completionPercent = Math.round((filled / template.fields.length) * 100);
    void onSave({ action: "save_form", formId: form.id, data, completionPercent, lastEditedBy: "Sistema" });
  }

  return (
    <form className="client-dynamic-form" onSubmit={handleSubmit}>
      <header>
        <div>
          <h2>{template.label}</h2>
          <span>{form.completionPercent}% preenchido | ultima alteracao {formatDate(form.updatedAt)}</span>
        </div>
        <button type="submit">Salvar rascunho</button>
      </header>
      <div className="client-form-grid">
        {template.fields.map((field) => (
          <label key={field}>
            <span>{field}</span>
            <textarea name={field} defaultValue={String(form.data[field] ?? "")} rows={2} />
          </label>
        ))}
      </div>
    </form>
  );
}

function TrainingsTab({
  onboardingId,
  trainings,
  onSave,
}: {
  onboardingId: string;
  trainings: TrainingRecord[];
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void onSave({
      action: "add_training",
      onboardingId,
      title: String(formData.get("title") ?? ""),
      type: String(formData.get("type") ?? "Treinamento de gestao"),
      scheduledAt: dateToIso(String(formData.get("scheduledAt") ?? "")),
      fxpOwnerName: String(formData.get("fxpOwnerName") ?? ""),
      participants: String(formData.get("participants") ?? ""),
      contentCovered: String(formData.get("contentCovered") ?? ""),
      status: String(formData.get("status") ?? "Agendado"),
    });
    event.currentTarget.reset();
  }

  return (
    <section className="client-tab-panel split-panel">
      <form className="client-side-form" onSubmit={handleSubmit}>
        <h2>Registrar treinamento</h2>
        <input name="title" placeholder="Titulo" required />
        <select name="type">
          <option>Treinamento de gestao</option>
          <option>Treinamento comercial</option>
          <option>Treinamento de atendimento</option>
          <option>Treinamento tecnico</option>
          <option>Reciclagem</option>
        </select>
        <input name="scheduledAt" type="date" />
        <input name="fxpOwnerName" placeholder="Responsavel da FXP" />
        <input name="participants" placeholder="Participantes" />
        <textarea name="contentCovered" placeholder="Conteudo abordado" />
        <select name="status">
          <option>Agendado</option>
          <option>Realizado</option>
          <option>Reagendado</option>
          <option>Cancelado</option>
        </select>
        <button type="submit">Registrar treinamento</button>
      </form>
      <div className="record-list">
        {trainings.map((training) => (
          <article key={training.id}>
            <strong>{training.title}</strong>
            <span>{training.type} | {training.status}</span>
            <small>{formatDate(training.scheduledAt)} | {training.fxpOwnerName || "Responsavel nao informado"}</small>
            <p>{training.contentCovered}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryTab({
  history,
  notes,
  onSave,
}: {
  history: HistoryRecord[];
  notes: NoteRecord[];
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void onSave({ action: "add_note", body: String(formData.get("body") ?? ""), authorName: "Sistema" });
    event.currentTarget.reset();
  }

  return (
    <section className="client-tab-panel split-panel">
      <form className="client-side-form" onSubmit={handleSubmit}>
        <h2>Adicionar observacao</h2>
        <textarea name="body" placeholder="Resumo do contato, ligacao ou observacao" required rows={5} />
        <button type="submit">Salvar observacao</button>
      </form>
      <div className="timeline-list">
        {[...notes.map((note) => ({ id: note.id, title: "Observacao", body: note.body, date: note.createdAt })), ...history.map((item) => ({ id: item.id, title: item.action, body: item.description, date: item.createdAt }))].map((item) => (
          <article key={item.id}>
            <span>{formatDateTime(item.date)}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DocumentsTab({ documents, onSave }: { documents: DocumentRecord[]; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void onSave({
      action: "add_document",
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? "Outros"),
      description: String(formData.get("description") ?? ""),
      fileUrl: String(formData.get("fileUrl") ?? ""),
    });
    event.currentTarget.reset();
  }

  return (
    <section className="client-tab-panel split-panel">
      <form className="client-side-form" onSubmit={handleSubmit}>
        <h2>Anexar documento</h2>
        <input name="name" placeholder="Nome do documento" required />
        <select name="type">
          <option>Contrato</option>
          <option>Proposta</option>
          <option>Formulario</option>
          <option>Material da empresa</option>
          <option>Tabela de precos</option>
          <option>Comprovante</option>
          <option>Ata de treinamento</option>
          <option>Termo de aceite</option>
          <option>Relatorio</option>
          <option>Outros</option>
        </select>
        <input name="fileUrl" placeholder="Link ou arquivo" />
        <textarea name="description" placeholder="Descricao" />
        <button type="submit">Salvar documento</button>
      </form>
      <div className="record-list">
        {documents.map((document) => (
          <article key={document.id}>
            <strong>{document.name}</strong>
            <span>{document.type} | {formatDate(document.createdAt)}</span>
            <p>{document.description}</p>
            {document.fileUrl ? <a href={document.fileUrl}>Abrir documento</a> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function PendingTab({
  onboardingId,
  pendingItems,
  onSave,
}: {
  onboardingId: string;
  pendingItems: PendingRecord[];
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void onSave({
      action: "add_pending_item",
      onboardingId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? ""),
      responsibleName: String(formData.get("responsibleName") ?? ""),
      priority: String(formData.get("priority") ?? "Media"),
      dueAt: dateToIso(String(formData.get("dueAt") ?? "")),
      status: String(formData.get("status") ?? "Aberta"),
    });
    event.currentTarget.reset();
  }

  return (
    <section className="client-tab-panel split-panel">
      <form className="client-side-form" onSubmit={handleSubmit}>
        <h2>Criar pendencia</h2>
        <input name="title" placeholder="Titulo" required />
        <textarea name="description" placeholder="Descricao" />
        <input name="category" placeholder="Categoria" />
        <input name="responsibleName" placeholder="Responsavel" />
        <select name="priority">
          <option>Baixa</option>
          <option>Media</option>
          <option>Alta</option>
          <option>Critica</option>
        </select>
        <input name="dueAt" type="date" />
        <select name="status">
          <option>Aberta</option>
          <option>Em andamento</option>
          <option>Aguardando cliente</option>
          <option>Aguardando equipe tecnica</option>
          <option>Resolvida</option>
          <option>Cancelada</option>
        </select>
        <button type="submit">Salvar pendencia</button>
      </form>
      <div className="record-list">
        {pendingItems.map((item) => (
          <article className={isOverdue(item.dueAt) ? "overdue" : ""} key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.priority} | {item.status} | prazo {formatDate(item.dueAt)}</span>
            <p>{item.description}</p>
            <button type="button" onClick={() => onSave({ action: "update_pending_status", pendingId: item.id, status: "Resolvida" })}>
              Marcar resolvida
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="client-info-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildStats(checklist: ChecklistItem[], onboarding: ClientOnboarding | null, pendingItems: PendingRecord[]) {
  const startedAt = onboarding?.onboardingStartedAt ? new Date(onboarding.onboardingStartedAt) : new Date();
  return {
    elapsedDays: Math.max(0, Math.ceil((Date.now() - startedAt.getTime()) / 86400000)),
    pending: checklist.filter((item) => !item.isCompleted).length,
    blocked: checklist.filter((item) => item.isBlocked).length,
    overdue: checklist.filter((item) => isOverdue(item.dueAt)).length + pendingItems.filter((item) => isOverdue(item.dueAt)).length,
    lastContact: "Consultar historico",
    nextContact: "Definir proximo contato",
  };
}

function buildBottlenecks(checklist: ChecklistItem[], onboarding: ClientOnboarding | null, pendingItems: PendingRecord[]) {
  const bottlenecks: { problem: string; impact: string; owner: string; stoppedTime: string; action: string }[] = [];
  if (checklist.some((item) => item.label === "WhatsApp conectado" && !item.isCompleted)) {
    bottlenecks.push({
      problem: "WhatsApp ainda nao conectado",
      impact: "IA nao consegue operar no atendimento real",
      owner: "Tecnico",
      stoppedTime: `${buildStats(checklist, onboarding, pendingItems).elapsedDays} dias`,
      action: "Conectar numero, validar Evolution API e testar webhook.",
    });
  }
  if (pendingItems.some((item) => item.priority === "Critica" && item.status !== "Resolvida")) {
    bottlenecks.push({
      problem: "Pendencia critica aberta",
      impact: "Implantacao pode atrasar ou ficar bloqueada",
      owner: "Customer Success",
      stoppedTime: "Em aberto",
      action: "Tratar pendencia critica antes de avancar para aceite.",
    });
  }
  if (checklist.some((item) => item.stageKey === "treinamento" && !item.isCompleted)) {
    bottlenecks.push({
      problem: "Treinamento ainda nao concluido",
      impact: "Equipe pode nao usar o sistema corretamente",
      owner: "CS",
      stoppedTime: "Pendente",
      action: "Agendar treinamento da equipe e registrar participantes.",
    });
  }
  return bottlenecks;
}

function formatDate(value?: string | null) {
  if (!value) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function dateToIso(value: string) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toISOString();
}

function isOverdue(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return date.getTime() < Date.now();
}
