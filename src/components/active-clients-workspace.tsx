"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

const clientStages = [
  { id: "documentos", label: "Documentacao", tone: "docs" },
  { id: "onboarding", label: "Onboarding", tone: "blue" },
  { id: "implantacao", label: "Implementacao", tone: "purple" },
  { id: "treinamento", label: "Treinamento", tone: "orange" },
  { id: "acompanhamento", label: "Acompanhamento", tone: "green" },
  { id: "renovacao", label: "Renovacao", tone: "pink" },
] as const;

type ClientStageId = (typeof clientStages)[number]["id"];
type ModalMode = "create" | "edit" | null;

interface ActiveClientCredential {
  id: string;
  label: string;
  url?: string | null;
  username?: string | null;
  password?: string | null;
  apiKey?: string | null;
  token?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface ActiveClientDocument {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  fileUrl?: string | null;
  createdAt: string;
}

interface ActiveClientNote {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

interface ActiveClientHistory {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

interface ActiveClient {
  id: string;
  companyName: string;
  responsibleName: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  stage: ClientStageId;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  credentials: ActiveClientCredential[];
  documents: ActiveClientDocument[];
  observations: ActiveClientNote[];
  history: ActiveClientHistory[];
}

export function ActiveClientsWorkspace() {
  const router = useRouter();
  const [clients, setClients] = useState<ActiveClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<ClientStageId | "all">("all");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [formError, setFormError] = useState("");
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadClients();
  }, []);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const filteredClients = useMemo(() => {
    const normalizedSearch = normalize(search);
    return clients.filter((client) => {
      const matchesStage = stageFilter === "all" || client.stage === stageFilter;
      const searchable = [client.companyName, client.responsibleName, client.phone, client.email, client.city]
        .map((value) => normalize(value ?? ""))
        .join(" ");
      return matchesStage && searchable.includes(normalizedSearch);
    });
  }, [clients, search, stageFilter]);

  async function loadClients() {
    setLoading(true);
    try {
      const response = await fetch("/api/active-clients", { cache: "no-store" });
      const result = (await response.json()) as { ok?: boolean; clients?: ActiveClient[]; error?: string };
      if (!result.ok || !result.clients) {
        showToast(result.error ?? "Erro ao carregar clientes.");
        return;
      }

      setClients(result.clients);
      setSelectedClientId((currentId) =>
        currentId && result.clients?.some((client) => client.id === currentId) ? currentId : null,
      );
    } catch {
      showToast("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      companyName: String(formData.get("companyName") ?? "").trim(),
      responsibleName: String(formData.get("responsibleName") ?? "").trim(),
      phone: onlyDigits(String(formData.get("phone") ?? "")),
      email: String(formData.get("email") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      stage: String(formData.get("stage") ?? "documentos"),
      notes: String(formData.get("notes") ?? "").trim(),
    };

    if (!payload.companyName || !payload.responsibleName || payload.phone.length < 8 || !payload.stage) {
      setFormError("Preencha nome, responsavel, telefone e etapa.");
      return;
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setFormError("Informe um e-mail valido.");
      return;
    }

    const body = modalMode === "edit" && selectedClient ? { ...payload, id: selectedClient.id, action: "update_client" } : payload;
    const method = modalMode === "edit" ? "PATCH" : "POST";
    const result = await saveAction(method, body);
    if (!result.ok) {
      setFormError(result.error ?? "Erro ao salvar cliente.");
      return;
    }

    setModalMode(null);
    showToast(modalMode === "edit" ? "Cliente atualizado com sucesso." : "Cliente cadastrado com sucesso.");
    await loadClients();
    setSelectedClientId(null);
  }

  async function handleStageChange(clientId: string, stage: ClientStageId) {
    setClients((current) => current.map((client) => (client.id === clientId ? { ...client, stage } : client)));
    const result = await saveAction("PATCH", { id: clientId, action: "update_stage", stage });
    if (!result.ok) {
      showToast(result.error ?? "Erro ao alterar etapa.");
      await loadClients();
      return;
    }

    showToast("Etapa alterada com sucesso.");
    await loadClients();
  }

  async function handleDeleteClient(clientId: string) {
    if (!window.confirm("Excluir este cliente? Esta acao remove o cliente da tela, mas preserva auditoria.")) return;
    const result = await saveAction("PATCH", { id: clientId, action: "delete_client" });
    if (!result.ok) {
      showToast(result.error ?? "Erro ao excluir cliente.");
      return;
    }

    showToast("Cliente excluido.");
    setSelectedClientId(null);
    await loadClients();
  }

  async function handleAddChild(event: FormEvent<HTMLFormElement>, action: "add_document" | "add_credential" | "add_note") {
    event.preventDefault();
    if (!selectedClient) return;
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const result = await saveAction("PATCH", { ...payload, clientId: selectedClient.id, action });
    if (!result.ok) {
      showToast(result.error ?? "Erro ao salvar.");
      return;
    }

    event.currentTarget.reset();
    showToast(action === "add_document" ? "Documento salvo." : action === "add_credential" ? "Credencial salva." : "Observacao salva.");
    await loadClients();
  }

  async function handleDeleteChild(action: "delete_document" | "delete_credential" | "delete_note", id: string) {
    if (!selectedClient || !window.confirm("Confirmar exclusao deste item?")) return;
    const result = await saveAction("PATCH", { action, id, clientId: selectedClient.id });
    if (!result.ok) {
      showToast(result.error ?? "Erro ao excluir.");
      return;
    }

    showToast("Item excluido.");
    await loadClients();
  }

  async function copySecret(value: string | null | undefined) {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    showToast("Informacao copiada.");
  }

  async function saveAction(method: "POST" | "PATCH", body: Record<string, unknown>) {
    try {
      const response = await fetch("/api/active-clients", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return (await response.json()) as { ok?: boolean; id?: string; error?: string };
    } catch {
      return { ok: false, error: "Erro de comunicacao com o servidor." };
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  return (
    <section id="clientes" className="clients-panel">
      {toast ? <div className="client-toast">{toast}</div> : null}

      {clients.length === 0 && !loading ? (
        <div className="clients-empty-page">
          <span className="eyebrow">Clientes</span>
          <h2>Clientes</h2>
          <p>Cadastre e acompanhe todos os clientes da sua operacao.</p>
          <button className="client-gradient-button" type="button" onClick={() => setModalMode("create")}>
            <span>+</span> Adicionar cliente
          </button>
        </div>
      ) : null}

      {loading ? <ClientSkeleton /> : null}

      {clients.length > 0 && !loading ? (
        <>
          <header className="clients-header">
            <div>
              <span className="eyebrow">Clientes</span>
              <h2>Clientes</h2>
            </div>
            <button className="client-gradient-button" type="button" onClick={() => setModalMode("create")}>
              <span>+</span> Adicionar cliente
            </button>
          </header>

          <div className="clients-toolbar">
            <label>
              <span>Buscar</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome da empresa ou responsavel..." />
            </label>
            <label>
              <span>Filtrar etapa</span>
              <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as ClientStageId | "all")}>
                <option value="all">Todas as etapas</option>
                {clientStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredClients.length === 0 ? (
            <div className="clients-empty-state">Nenhum resultado encontrado na busca</div>
          ) : (
            <div className="clients-table">
              {filteredClients.map((client) => (
                <article className="client-row" key={client.id}>
                  <button type="button" onClick={() => router.push(`/clientes/${client.id}`)}>
                    <strong>{client.companyName}</strong>
                    <span>Responsavel: {client.responsibleName}</span>
                  </button>
                  <div className="client-row-actions">
                    <button type="button" onClick={() => router.push(`/clientes/${client.id}`)}>Detalhes</button>
                    <button type="button" onClick={() => { setSelectedClientId(client.id); setModalMode("edit"); }}>Editar</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {selectedClient ? (
            <ClientDetails
              client={selectedClient}
              onClose={() => setSelectedClientId(null)}
              onEdit={() => setModalMode("edit")}
              onStageChange={(stage) => handleStageChange(selectedClient.id, stage)}
              onAddChild={handleAddChild}
              onDeleteChild={handleDeleteChild}
              visibleSecrets={visibleSecrets}
              setVisibleSecrets={setVisibleSecrets}
              onCopy={copySecret}
            />
          ) : null}
        </>
      ) : null}

      {modalMode ? (
        <ClientModal
          client={modalMode === "edit" ? selectedClient : null}
          error={formError}
          onClose={() => {
            setModalMode(null);
            setFormError("");
          }}
          onSubmit={handleSaveClient}
        />
      ) : null}
    </section>
  );
}

function ClientDetails({
  client,
  onClose,
  onEdit,
  onStageChange,
  onAddChild,
  onDeleteChild,
  visibleSecrets,
  setVisibleSecrets,
  onCopy,
}: {
  client: ActiveClient;
  onClose: () => void;
  onEdit: () => void;
  onStageChange: (stage: ClientStageId) => void;
  onAddChild: (event: FormEvent<HTMLFormElement>, action: "add_document" | "add_credential" | "add_note") => void;
  onDeleteChild: (action: "delete_document" | "delete_credential" | "delete_note", id: string) => void;
  visibleSecrets: Record<string, boolean>;
  setVisibleSecrets: (value: (current: Record<string, boolean>) => Record<string, boolean>) => void;
  onCopy: (value: string | null | undefined) => void;
}) {
  return (
    <div className="client-details-overlay">
    <div className="client-details">
      <header className="client-detail-hero">
        <div>
          <h3>{client.companyName}</h3>
          <p>{client.responsibleName} | {client.phone} | {client.city || "Cidade nao informada"}</p>
        </div>
        <ClientStageBadge stage={client.stage} />
        <button type="button" onClick={onEdit}>Editar</button>
        <select value={client.stage} onChange={(event) => onStageChange(event.target.value as ClientStageId)}>
          {clientStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </select>
        <button type="button" onClick={onClose}>Fechar</button>
      </header>

      <div className="client-detail-grid">
        <section className="client-detail-card">
          <h4>Informacoes gerais</h4>
          <dl>
            <dt>Nome</dt><dd>{client.companyName}</dd>
            <dt>Responsavel</dt><dd>{client.responsibleName}</dd>
            <dt>Telefone</dt><dd>{client.phone}</dd>
            <dt>E-mail</dt><dd>{client.email || "Nao informado"}</dd>
            <dt>Cidade</dt><dd>{client.city || "Nao informada"}</dd>
            <dt>Cadastro</dt><dd>{formatDate(client.createdAt)}</dd>
            <dt>Atualizacao</dt><dd>{formatDate(client.updatedAt)}</dd>
            <dt>Observacoes</dt><dd>{client.notes || "Nenhuma observacao"}</dd>
          </dl>
        </section>

        <section className="client-detail-card">
          <h4>Documentos</h4>
          <CompactForm actionLabel="+ Adicionar documento" fields={["name:Nome do documento", "type:Tipo", "fileUrl:Arquivo ou link", "description:Descricao"]} onSubmit={(event) => onAddChild(event, "add_document")} />
          {client.documents.length === 0 ? <EmptyLine text="Nenhum documento cadastrado" /> : client.documents.map((document) => (
            <div className="client-mini-item" key={document.id}>
              <strong>{document.name}</strong>
              <span>{document.type} | {formatDate(document.createdAt)}</span>
              <small>{document.description || "Sem descricao"}</small>
              {document.fileUrl ? <a href={document.fileUrl} target="_blank">Abrir link</a> : null}
              <button type="button" onClick={() => onDeleteChild("delete_document", document.id)}>Excluir</button>
            </div>
          ))}
        </section>

        <section className="client-detail-card">
          <h4>Credenciais e acessos</h4>
          <CompactForm actionLabel="+ Adicionar credencial" fields={["label:Servico", "url:Link de acesso", "username:Login ou usuario", "password:Senha", "apiKey:Chave de API", "token:Token", "notes:Observacoes"]} onSubmit={(event) => onAddChild(event, "add_credential")} />
          {client.credentials.length === 0 ? <EmptyLine text="Nenhuma credencial cadastrada" /> : client.credentials.map((credential) => {
            const isVisible = Boolean(visibleSecrets[credential.id]);
            return (
              <div className="client-mini-item sensitive" key={credential.id}>
                <strong>{credential.label}</strong>
                <span>{credential.url || "Link nao informado"}</span>
                <span>Usuario: {credential.username || "nao informado"}</span>
                <SecretLine label="Senha" value={credential.password} visible={isVisible} onCopy={onCopy} />
                <SecretLine label="API key" value={credential.apiKey} visible={isVisible} onCopy={onCopy} />
                <SecretLine label="Token" value={credential.token} visible={isVisible} onCopy={onCopy} />
                <div className="mini-actions">
                  <button type="button" onClick={() => setVisibleSecrets((current) => ({ ...current, [credential.id]: !current[credential.id] }))}>{isVisible ? "Ocultar" : "Mostrar"}</button>
                  <button type="button" onClick={() => onDeleteChild("delete_credential", credential.id)}>Excluir</button>
                </div>
              </div>
            );
          })}
        </section>

        <section className="client-detail-card">
          <h4>Observacoes</h4>
          <CompactForm actionLabel="+ Adicionar observacao" fields={["body:Observacao", "authorName:Quem adicionou"]} onSubmit={(event) => onAddChild(event, "add_note")} />
          {client.observations.length === 0 ? <EmptyLine text="Nenhuma observacao cadastrada" /> : client.observations.map((note) => (
            <div className="client-mini-item" key={note.id}>
              <strong>{note.authorName}</strong>
              <span>{formatDate(note.createdAt)}</span>
              <small>{note.body}</small>
              <button type="button" onClick={() => onDeleteChild("delete_note", note.id)}>Excluir</button>
            </div>
          ))}
        </section>

        <section className="client-detail-card">
          <h4>Historico</h4>
          {client.history.length === 0 ? <EmptyLine text="Nenhum historico registrado" /> : client.history.map((item) => (
            <div className="client-history-item" key={item.id}>
              <span>{formatDate(item.createdAt)}</span>
              <strong>{item.description}</strong>
            </div>
          ))}
        </section>
      </div>
    </div>
    </div>
  );
}

function ClientModal({ client, error, onClose, onSubmit }: { client: ActiveClient | null; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="client-modal-overlay" role="presentation">
      <form className="client-modal" onSubmit={onSubmit}>
        <header>
          <h3>{client ? "Editar cliente" : "Cadastrar novo cliente"}</h3>
          <button type="button" onClick={onClose}>x</button>
        </header>
        <div className="client-modal-grid">
          <Field name="companyName" label="Nome da empresa ou cliente" placeholder="Autoescola Modelo" defaultValue={client?.companyName} required />
          <Field name="responsibleName" label="Nome do responsavel" placeholder="Responsavel comercial" defaultValue={client?.responsibleName} required />
          <Field name="phone" label="Telefone" placeholder="5571999999999" defaultValue={client?.phone} required />
          <Field name="email" label="E-mail" placeholder="cliente@email.com" defaultValue={client?.email ?? ""} />
          <Field name="city" label="Cidade" placeholder="Cidade" defaultValue={client?.city ?? ""} />
          <label>
            <span>Etapa atual</span>
            <select name="stage" defaultValue={client?.stage ?? "documentos"} required>
              {clientStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
            </select>
          </label>
        </div>
        <label>
          <span>Observacoes</span>
          <textarea name="notes" placeholder="Pendencias, combinados e proximas acoes" defaultValue={client?.notes ?? ""} rows={4} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <footer>
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="client-gradient-button" type="submit">Salvar cliente</button>
        </footer>
      </form>
    </div>
  );
}

function Field({ name, label, placeholder, defaultValue, required }: { name: string; label: string; placeholder: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} placeholder={placeholder} defaultValue={defaultValue ?? ""} required={required} />
    </label>
  );
}

function CompactForm({ actionLabel, fields, onSubmit }: { actionLabel: string; fields: string[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="compact-client-form" onSubmit={onSubmit}>
      {fields.map((field) => {
        const [name, label] = field.split(":");
        return <input key={name} name={name} placeholder={label} required={name === "name" || name === "label" || name === "body" || name === "type"} />;
      })}
      <button type="submit">{actionLabel}</button>
    </form>
  );
}

function ClientStageBadge({ stage }: { stage: ClientStageId }) {
  const stageInfo = clientStages.find((item) => item.id === stage) ?? clientStages[0];
  return <span className={`client-stage-badge ${stageInfo.tone}`}>{stageInfo.label}</span>;
}

function SecretLine({ label, value, visible, onCopy }: { label: string; value?: string | null; visible: boolean; onCopy: (value?: string | null) => void }) {
  if (!value) return null;
  return (
    <span className="secret-line">
      {label}: {visible ? value : "********"}
      <button type="button" onClick={() => onCopy(value)}>Copiar</button>
    </span>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="client-empty-line">{text}</div>;
}

function ClientSkeleton() {
  return (
    <div className="client-skeleton">
      <span />
      <span />
      <span />
    </div>
  );
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
