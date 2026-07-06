"use client";

import type { CSSProperties, DragEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  commercialAgentPrompts,
  followUpTags,
  qualificationTags,
  type CommercialAgentPrompt,
} from "@/lib/qualification/agent-prompts";

const kanbanStages = [
  { id: "novo", label: "Novo Lead", tone: "neutral" },
  { id: "ia", label: "IA Atendendo", tone: "info" },
  { id: "qualificado", label: "Qualificado", tone: "success" },
  { id: "agendamento", label: "Agendamento", tone: "warning" },
  { id: "nao_qualificado", label: "Nao Qualificado", tone: "danger" },
] as const;

type KanbanStageId = (typeof kanbanStages)[number]["id"];
type AppPage = "dashboard" | "funil" | "conversas" | "agenda" | "iaComercial" | "integracoes";

const appPages: { id: AppPage; label: string; badge?: number }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "funil", label: "Funil" },
  { id: "conversas", label: "Conversas" },
  { id: "agenda", label: "Agenda" },
  { id: "iaComercial", label: "IA Comercial" },
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

interface CalendarAppointment {
  id: string;
  leadId: string;
  leadName: string;
  responsibleName: string;
  phone: string;
  city: string | null;
  runsPaidTraffic: boolean | null;
  mainPain: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
}

interface CalendarAvailableSlot {
  startsAt: string;
  endsAt: string;
  label: string;
}

interface ConversationContact {
  id: string;
  name: string;
  initials: string;
  preview: string;
  time: string;
  channel: string;
  unread?: number;
}

interface ConversationMessage {
  id: string;
  author: "lead" | "operator";
  sender?: string;
  text: string;
  time: string;
}

interface IntegrationField {
  key: string;
  label: string;
  placeholder: string;
  type?: "password" | "text";
}

interface IntegrationGroup {
  id: "system" | "database" | "evolution" | "aiMemory";
  title: string;
  description: string;
  fields: IntegrationField[];
}

interface SavedIntegrationSetting {
  key: string;
  value: string;
  isSecret: boolean;
  hasValue: boolean;
}

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

const conversationContacts: ConversationContact[] = [
  {
    id: "marcio",
    name: "Marcio",
    initials: "M",
    preview: "Fechando comigo, consigo um desconto espe...",
    time: "5 h",
    channel: "Facebook Ads",
    unread: 2,
  },
  {
    id: "roanderson",
    name: "Roanderson Leite",
    initials: "RL",
    preview: "Gostaria de saber se ja conseguiu marcar a pro...",
    time: "5 h",
    channel: "Instagram Ads",
  },
  {
    id: "xandy",
    name: "Xandy",
    initials: "X",
    preview: "[imagem recebida]",
    time: "5 h",
    channel: "WhatsApp",
    unread: 1,
  },
  {
    id: "soldado",
    name: "Soldado",
    initials: "S",
    preview: "Ta ok obrigado.",
    time: "6 h",
    channel: "WhatsApp",
  },
  {
    id: "coracoes",
    name: "Lead ativo",
    initials: "LA",
    preview: "Estou cobrando todos os dias e nada",
    time: "6 h",
    channel: "WhatsApp",
  },
  {
    id: "bruno",
    name: "Bruno",
    initials: "B",
    preview: "Aqui no br",
    time: "6 h",
    channel: "Google Ads",
  },
  {
    id: "denilson",
    name: "Denilson Rabelo",
    initials: "DR",
    preview: "Mas uns dias ?",
    time: "6 h",
    channel: "WhatsApp",
  },
];

const conversationThread: Record<string, ConversationMessage[]> = {
  soldado: [
    {
      id: "msg-1",
      author: "lead",
      text: "Ola, boa tarde !",
      time: "9 h",
    },
    {
      id: "msg-2",
      author: "lead",
      text: "Devo estar ai na escola que horas ?",
      time: "9 h",
    },
    {
      id: "msg-3",
      author: "operator",
      sender: "Superadmin - Super Admin",
      text: "Ola, bom dia!",
      time: "6 h",
    },
    {
      id: "msg-4",
      author: "operator",
      sender: "Superadmin - Super Admin",
      text: "o exame e no Detran, precisa estar la as 08:00 Caso queira ir na carona do veiculo, precisa esta aqui na auto escola as 07:00, o carro sai daqui nesse horario",
      time: "6 h",
    },
    {
      id: "msg-5",
      author: "lead",
      text: "Ta ok obrigado.",
      time: "6 h",
    },
  ],
  marcio: [
    {
      id: "msg-marcio-1",
      author: "lead",
      text: "Fechando comigo, consigo um desconto especial?",
      time: "5 h",
    },
    {
      id: "msg-marcio-2",
      author: "operator",
      sender: "fxphub IA",
      text: "Consigo verificar as condicoes para sua autoescola. Quantas matriculas voces fazem por mes?",
      time: "5 h",
    },
  ],
};

const defaultConversationMessages: ConversationMessage[] = [
  {
    id: "default-1",
    author: "lead",
    text: "Tenho interesse em organizar melhor meu atendimento pelo WhatsApp.",
    time: "6 h",
  },
  {
    id: "default-2",
    author: "operator",
    sender: "fxphub IA",
    text: "Perfeito. Vou registrar seu contexto e manter o historico completo para o comercial.",
    time: "6 h",
  },
];

const pains = [
  "Falta de CRM",
  "Leads perdidos",
  "Atendimento manual",
  "Baixa conversao",
  "Demora no atendimento",
];

const integrationGroups: IntegrationGroup[] = [
  {
    id: "system",
    title: "Sistema",
    description: "Ambiente de producao e usuario tecnico.",
    fields: [
      {
        key: "SYSTEM_USER_ID",
        label: "System user ID",
        placeholder: "00000000-0000-0000-0000-000000000000",
      },
      { key: "MINIMUM_SCORE_TO_SCHEDULE", label: "Score minimo", placeholder: "55" },
      { key: "NODE_ENV", label: "Ambiente", placeholder: "production" },
      { key: "NEXT_TELEMETRY_DISABLED", label: "Telemetria Next", placeholder: "1" },
    ],
  },
  {
    id: "database",
    title: "Banco e CRM",
    description: "PostgreSQL/Supabase usados para leads, mensagens e agenda.",
    fields: [
      {
        key: "DATABASE_URL",
        label: "PostgreSQL URL",
        placeholder: "postgres://USUARIO:SENHA@HOST:5432/BANCO",
        type: "password",
      },
      { key: "SUPABASE_URL", label: "Supabase URL", placeholder: "https://seu-projeto.supabase.co" },
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        label: "Supabase service role",
        placeholder: "sua_service_role_key",
        type: "password",
      },
    ],
  },
  {
    id: "evolution",
    title: "WhatsApp",
    description: "Evolution API para receber e responder mensagens.",
    fields: [
      { key: "EVOLUTION_API_BASE_URL", label: "Evolution URL", placeholder: "https://sua-evolution-api.com" },
      { key: "EVOLUTION_API_KEY", label: "Evolution API key", placeholder: "sua_chave_evolution", type: "password" },
      { key: "EVOLUTION_INSTANCE_NAME", label: "Nome da instancia", placeholder: "fxphub" },
      {
        key: "EVOLUTION_WEBHOOK_SECRET",
        label: "Webhook secret",
        placeholder: "seu_segredo_forte",
        type: "password",
      },
    ],
  },
  {
    id: "aiMemory",
    title: "IA e memoria",
    description: "OpenAI para resposta inteligente e Redis para buffer.",
    fields: [
      { key: "OPENAI_API_KEY", label: "OpenAI API key", placeholder: "sua_chave_openai", type: "password" },
      { key: "OPENAI_MODEL", label: "Modelo OpenAI", placeholder: "gpt-4.1-mini" },
      { key: "REDIS_URL", label: "Redis URL", placeholder: "redis://HOST:6379", type: "password" },
      { key: "MESSAGE_BUFFER_QUIET_MS", label: "Buffer quiet ms", placeholder: "2500" },
      { key: "MESSAGE_BUFFER_TTL_SECONDS", label: "Buffer TTL", placeholder: "60" },
    ],
  },
];

const initialIntegrationValues = integrationGroups.reduce<Record<string, string>>((values, group) => {
  group.fields.forEach((field) => {
    values[field.key] = "";
  });
  return values;
}, {});

const secretIntegrationKeys = new Set(
  integrationGroups.flatMap((group) => group.fields.filter((field) => field.type === "password").map((field) => field.key)),
);

const calendarHours = Array.from({ length: 11 }, (_, index) => index + 8);

function buildWeekDays(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatAgendaDay(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "").toUpperCase();
}

function formatAgendaMonthRange(days: Date[]) {
  const first = days[0] ?? new Date();
  const last = days.at(-1) ?? first;
  const firstMonth = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(first).replace(".", "");
  const lastMonth = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(last).replace(".", "");
  const year = last.getFullYear();

  return firstMonth === lastMonth ? `${firstMonth}. ${year}` : `${firstMonth}. - ${lastMonth}. ${year}`;
}

function formatAgendaTime(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatDateInputValue(value: string | Date) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeInputValue(value: string | Date) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isSameAgendaDay(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [kanbanLeads, setKanbanLeads] = useState<KanbanLead[]>([]);
  const [kanbanStatus, setKanbanStatus] = useState("Carregando funil operacional...");
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("dashboard");
  const [selectedConversationId, setSelectedConversationId] = useState("soldado");
  const [integrationValues, setIntegrationValues] = useState(initialIntegrationValues);
  const [integrationSaved, setIntegrationSaved] = useState(false);
  const [savedIntegrationSecrets, setSavedIntegrationSecrets] = useState<Record<string, boolean>>({});
  const [integrationPersistenceStatus, setIntegrationPersistenceStatus] = useState("Carregando configuracoes...");
  const [envCopied, setEnvCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://fxphub.space/api/webhooks/evolution");
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [integrationValidation, setIntegrationValidation] = useState<Record<string, string>>({});
  const [evolutionTestPhone, setEvolutionTestPhone] = useState("");
  const [evolutionTestMessage, setEvolutionTestMessage] = useState("Teste fxphub: Evolution API conectada.");
  const [evolutionTestStatus, setEvolutionTestStatus] = useState("");
  const [calendarAppointments, setCalendarAppointments] = useState<CalendarAppointment[]>([]);
  const [calendarSlots, setCalendarSlots] = useState<CalendarAvailableSlot[]>([]);
  const [calendarStatus, setCalendarStatus] = useState("Carregando agenda interna...");
  const [agendaReferenceDate, setAgendaReferenceDate] = useState(new Date());
  const [agendaTouched, setAgendaTouched] = useState(false);
  const [selectedCalendarAppointmentId, setSelectedCalendarAppointmentId] = useState<string | null>(null);
  const [isEditingAppointment, setIsEditingAppointment] = useState(false);
  const [appointmentEditDate, setAppointmentEditDate] = useState("");
  const [appointmentEditTime, setAppointmentEditTime] = useState("");
  const [appointmentActionStatus, setAppointmentActionStatus] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhooks/evolution`);
    }
  }, []);

  useEffect(() => {
    loadKanbanLeads();
    const intervalId = window.setInterval(loadKanbanLeads, 7000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function loadKanbanLeads() {
    try {
      const response = await fetch("/api/funnel/leads", { cache: "no-store" });
      const result = (await response.json()) as {
        ok?: boolean;
        leads?: KanbanLead[];
        error?: string;
      };

      if (!result.ok || !result.leads) {
        setKanbanStatus(result.error ?? "Nao foi possivel carregar o funil.");
        return;
      }

      setKanbanLeads(result.leads);
      setKanbanStatus("Funil conectado ao banco. Atualiza conforme o Fausto muda as etapas.");
    } catch {
      setKanbanStatus("Nao foi possivel consultar o funil operacional.");
    }
  }

  useEffect(() => {
    async function loadCalendar() {
      try {
        const response = await fetch("/api/appointments/calendar", { cache: "no-store" });
        const result = (await response.json()) as {
          ok?: boolean;
          databaseAvailable?: boolean;
          appointments?: CalendarAppointment[];
          availableSlots?: CalendarAvailableSlot[];
        };

        if (!result.ok) {
          setCalendarStatus("Nao foi possivel carregar a agenda.");
          return;
        }

        setCalendarAppointments(result.appointments ?? []);
        setCalendarSlots(result.availableSlots ?? []);
        setCalendarStatus(
          result.databaseAvailable === false
            ? "Agenda interna ativa, mas o banco local nao esta conectado."
            : "Agenda interna conectada ao banco. Atualiza automaticamente.",
        );

        if (!agendaTouched) {
          const nextDate = result.appointments?.[0]?.startsAt ?? result.availableSlots?.[0]?.startsAt;
          if (nextDate) setAgendaReferenceDate(new Date(nextDate));
        }
      } catch {
        setCalendarStatus("Nao foi possivel consultar a agenda interna.");
      }
    }

    loadCalendar();
    const intervalId = window.setInterval(loadCalendar, 10000);
    return () => window.clearInterval(intervalId);
  }, [agendaTouched]);

  useEffect(() => {
    async function loadIntegrationSettings() {
      try {
        const response = await fetch("/api/integrations/config", { cache: "no-store" });
        const result = (await response.json()) as {
          ok?: boolean;
          settings?: SavedIntegrationSetting[];
          error?: string;
        };

        if (!result.ok || !result.settings) {
          setIntegrationPersistenceStatus(result.error ?? "Nao foi possivel carregar as integracoes salvas.");
          return;
        }

        const nextValues = { ...initialIntegrationValues };
        const nextSecrets: Record<string, boolean> = {};

        result.settings.forEach((setting) => {
          if (!setting.isSecret) nextValues[setting.key] = setting.value;
          if (setting.isSecret && setting.hasValue) nextSecrets[setting.key] = true;
        });

        setIntegrationValues(nextValues);
        setSavedIntegrationSecrets(nextSecrets);
        setIntegrationSaved(result.settings.some((setting) => setting.hasValue));
        setIntegrationPersistenceStatus("Configuracoes carregadas do servidor.");
      } catch {
        setIntegrationPersistenceStatus("Nao foi possivel consultar as integracoes salvas.");
      }
    }

    loadIntegrationSettings();
  }, []);

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

  async function handleDrop(event: DragEvent<HTMLElement>, nextStage: KanbanStageId) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/plain") || draggingLeadId;
    if (!leadId) return;

    const previousLeads = kanbanLeads;
    setKanbanLeads((currentLeads) =>
      currentLeads.map((lead) => (lead.id === leadId ? { ...lead, stage: nextStage } : lead)),
    );
    setDraggingLeadId(null);
    setKanbanStatus("Atualizando etapa do lead...");

    try {
      const response = await fetch("/api/funnel/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, stage: nextStage }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!result.ok) {
        setKanbanLeads(previousLeads);
        setKanbanStatus(result.error ?? "Nao foi possivel atualizar o lead.");
        return;
      }

      setKanbanStatus("Etapa atualizada no CRM.");
      void loadKanbanLeads();
    } catch {
      setKanbanLeads(previousLeads);
      setKanbanStatus("Nao foi possivel salvar a movimentacao.");
    }
  }

  function handleIntegrationChange(key: string, value: string) {
    setIntegrationValues((currentValues) => ({ ...currentValues, [key]: value }));
    if (secretIntegrationKeys.has(key)) {
      setSavedIntegrationSecrets((currentSecrets) => ({ ...currentSecrets, [key]: false }));
    }
    setIntegrationSaved(false);
    setEnvCopied(false);
  }

  async function handleSaveIntegrations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIntegrationPersistenceStatus("Salvando configuracoes...");

    try {
      const response = await fetch("/api/integrations/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: integrationValues }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        settings?: SavedIntegrationSetting[];
        error?: string;
      };

      if (!result.ok || !result.settings) {
        setIntegrationPersistenceStatus(result.error ?? "Falha ao salvar integracoes.");
        setIntegrationSaved(false);
        return;
      }

      const nextSecrets: Record<string, boolean> = {};
      const nextValues = { ...integrationValues };

      result.settings.forEach((setting) => {
        if (setting.isSecret && setting.hasValue) {
          nextSecrets[setting.key] = true;
          nextValues[setting.key] = "";
        }
      });

      setSavedIntegrationSecrets(nextSecrets);
      setIntegrationValues(nextValues);
      setIntegrationSaved(true);
      setIntegrationPersistenceStatus("Integracoes salvas no servidor.");
    } catch {
      setIntegrationPersistenceStatus("Nao foi possivel salvar no servidor.");
      setIntegrationSaved(false);
    }
  }

  async function handleCopyEnv() {
    const envText = buildEnvPreview();
    await navigator.clipboard?.writeText(envText);
    setEnvCopied(true);
  }

  async function handleCopyWebhook() {
    await navigator.clipboard?.writeText(webhookUrl);
    setWebhookCopied(true);
  }

  async function handleValidateIntegration(group: IntegrationGroup) {
    const missingFields = group.fields.filter(
      (field) => !integrationValues[field.key].trim() && !savedIntegrationSecrets[field.key],
    );
    const localStatus = missingFields.length
      ? `Campos pendentes: ${missingFields.map((field) => field.key).join(", ")}`
      : "Campos preenchidos.";

    try {
      const response = await fetch("/api/integrations/status", { cache: "no-store" });
      const status = (await response.json()) as Record<string, boolean>;
      const statusByGroup: Record<IntegrationGroup["id"], string> = {
        system: "Validacao local concluida.",
        database: `Servidor: ${status.databaseConfigured ? "DATABASE_URL ok" : "DATABASE_URL pendente"} / ${
          status.supabaseConfigured ? "Supabase ok" : "Supabase opcional pendente"
        }.`,
        evolution: `Servidor: ${status.evolutionConfigured ? "Evolution configurada" : "Evolution pendente"}.`,
        aiMemory: `Servidor: ${status.openAiConfigured ? "OpenAI ok" : "OpenAI pendente"} / ${
          status.redisConfigured ? "Redis ok" : "Redis pendente"
        }.`,
      };

      setIntegrationValidation((current) => ({
        ...current,
        [group.id]: `${localStatus} ${statusByGroup[group.id]}`,
      }));
    } catch {
      setIntegrationValidation((current) => ({
        ...current,
        [group.id]: `${localStatus} Nao foi possivel consultar o servidor.`,
      }));
    }
  }

  async function handleSendEvolutionTest() {
    setEvolutionTestStatus("Enviando...");

    try {
      const response = await fetch("/api/integrations/evolution/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: evolutionTestPhone,
          message: evolutionTestMessage,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      setEvolutionTestStatus(result.ok ? "Mensagem de teste enviada." : result.error ?? "Falha no envio.");
    } catch {
      setEvolutionTestStatus("Nao foi possivel chamar o teste da Evolution.");
    }
  }

  function handleAgendaToday() {
    setAgendaTouched(true);
    setAgendaReferenceDate(new Date());
  }

  function handleAgendaWeekOffset(offset: number) {
    setAgendaTouched(true);
    setAgendaReferenceDate((currentDate) => {
      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + offset * 7);
      return nextDate;
    });
  }

  function handleStartAppointmentEdit(appointment: CalendarAppointment) {
    setAppointmentEditDate(formatDateInputValue(appointment.startsAt));
    setAppointmentEditTime(formatTimeInputValue(appointment.startsAt));
    setAppointmentActionStatus("");
    setIsEditingAppointment(true);
  }

  async function handleSaveAppointmentEdit(appointment: CalendarAppointment) {
    if (!appointmentEditDate || !appointmentEditTime) {
      setAppointmentActionStatus("Informe data e horario.");
      return;
    }

    setAppointmentActionStatus("Salvando alteracao...");

    const previousStart = new Date(appointment.startsAt);
    const previousEnd = new Date(appointment.endsAt);
    const durationMs = Math.max(30 * 60 * 1000, previousEnd.getTime() - previousStart.getTime());
    const nextStart = new Date(`${appointmentEditDate}T${appointmentEditTime}:00`);
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    try {
      const response = await fetch("/api/appointments/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appointment.id,
          startsAt: nextStart.toISOString(),
          endsAt: nextEnd.toISOString(),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        appointment?: { id: string; startsAt: string; endsAt: string; status: string };
      };

      if (!result.ok || !result.appointment) {
        setAppointmentActionStatus(result.error ?? "Nao foi possivel atualizar.");
        return;
      }

      setCalendarAppointments((currentAppointments) =>
        currentAppointments.map((currentAppointment) =>
          currentAppointment.id === appointment.id
            ? {
                ...currentAppointment,
                startsAt: result.appointment!.startsAt,
                endsAt: result.appointment!.endsAt,
                status: result.appointment!.status,
              }
            : currentAppointment,
        ),
      );
      setAgendaReferenceDate(nextStart);
      setIsEditingAppointment(false);
      setAppointmentActionStatus("Agendamento atualizado.");
    } catch {
      setAppointmentActionStatus("Erro ao atualizar agendamento.");
    }
  }

  async function handleDeleteAppointment(appointment: CalendarAppointment) {
    setAppointmentActionStatus("Apagando agendamento...");

    try {
      const response = await fetch("/api/appointments/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointment.id }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!result.ok) {
        setAppointmentActionStatus(result.error ?? "Nao foi possivel apagar.");
        return;
      }

      setCalendarAppointments((currentAppointments) =>
        currentAppointments.filter((currentAppointment) => currentAppointment.id !== appointment.id),
      );
      setSelectedCalendarAppointmentId(null);
      setIsEditingAppointment(false);
      setAppointmentActionStatus("");
    } catch {
      setAppointmentActionStatus("Erro ao apagar agendamento.");
    }
  }

  function buildEnvPreview() {
    return integrationGroups
      .map((group) =>
        group.fields
          .map((field) => {
            const value = integrationValues[field.key].trim();
            if (!value && savedIntegrationSecrets[field.key]) return `${field.key}=<salvo_no_servidor>`;
            return `${field.key}=${value || field.placeholder}`;
          })
          .join("\n"),
      )
      .join("\n\n");
  }

  const selectedConversation =
    conversationContacts.find((contact) => contact.id === selectedConversationId) ?? conversationContacts[0];
  const activeConversationMessages =
    conversationThread[selectedConversation?.id ?? ""] ?? defaultConversationMessages;
  const integrationFields = integrationGroups.flatMap((group) => group.fields);
  const filledIntegrationCount = integrationFields.filter(
    (field) => integrationValues[field.key].trim() || savedIntegrationSecrets[field.key],
  ).length;
  const envPreview = buildEnvPreview();
  const agendaWeekDays = buildWeekDays(agendaReferenceDate);
  const agendaMonthRange = formatAgendaMonthRange(agendaWeekDays);
  const nextCalendarSlots = calendarSlots.slice(0, 5);
  const calendarEventsByDay = agendaWeekDays.map((day) => ({
    day,
    events: calendarAppointments.filter((appointment) => isSameAgendaDay(new Date(appointment.startsAt), day)),
  }));
  const selectedCalendarAppointment =
    calendarAppointments.find((appointment) => appointment.id === selectedCalendarAppointmentId) ?? null;

  if (!isAuthenticated) {
    return (
      <main className="login-screen">
        <section className="login-panel" aria-label="Acesso ao fxphub">
          <div className="brand login-brand">
            <div className="brand-mark">fx</div>
            <div>
              <strong>fxphub</strong>
              <span>AI Commercial Hub</span>
            </div>
          </div>

          <div className="login-copy">
            <span className="eyebrow">Acesso comercial</span>
            <h1>Entre no hub comercial</h1>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              <span>E-mail</span>
              <input name="email" type="email" placeholder="operador@fxphub.space" autoComplete="email" />
            </label>

            <label>
              <span>Senha</span>
              <input name="password" type="password" placeholder="Digite sua senha" autoComplete="current-password" />
            </label>

            {loginError ? <p className="form-error">{loginError}</p> : null}

            <button type="submit">Entrar</button>
          </form>
        </section>

      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="brand">
          <div className="brand-mark">fx</div>
          <div>
            <strong>fxphub</strong>
            <span>AI Commercial Hub</span>
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
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">fxphub workspace</span>
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
              <span className="eyebrow">Operacao</span>
              <h2>Visao geral</h2>
            </div>

            <div className="metric-grid">
              <div className="metric">
                <span>Leads hoje</span>
                <strong>77</strong>
              </div>
              <div className="metric">
                <span>Qualificados</span>
                <strong>23</strong>
              </div>
              <div className="metric">
                <span>Agenda salva</span>
                <strong>9h</strong>
              </div>
            </div>

            <div className="growth-chart" aria-label="Evolucao mensal de qualificacao">
              <div className="chart-toolbar">
                <span>Performance anual</span>
                <b>+24.8%</b>
              </div>
              <div className="chart-line">
                {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map(
                  (month, index) => (
                    <span
                      className={index === 9 ? "active" : ""}
                      key={month}
                      style={{ "--point": `${34 + index * 4 + (index % 3) * 5}%` } as CSSProperties}
                    >
                      {month}
                    </span>
                  ),
                )}
              </div>
            </div>
          </article>

          <article className="score-panel">
            <div className="score-ring">
              <span>91</span>
              <small>Score A</small>
            </div>
            <h2>CFC Catuense</h2>
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
            <div className="kanban-sync">
              <span>{kanbanStatus}</span>
              <button type="button" onClick={loadKanbanLeads}>
                Atualizar
              </button>
            </div>
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

                    {stageLeads.length === 0 ? <div className="kanban-empty">Sem leads nesta etapa</div> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="conversas" className={`support-console ${activePage === "conversas" ? "" : "page-hidden"}`}>
          <header className="support-topbar">
            <div>
              <h2>Central de Atendimento</h2>
            </div>

            <div className="support-tools" aria-label="Ferramentas de atendimento">
              <label className="support-search">
                <span>Q</span>
                <input placeholder="Buscar leads, conversas, clientes..." />
              </label>
              <button className="ai-status-button" type="button">
                Status da IA <strong>Ativo</strong>
              </button>
              <button className="icon-button" type="button" aria-label="Notificacoes">
                1
              </button>
              <div className="support-logo">fx</div>
            </div>
          </header>

          <div className="support-body">
            <aside className="inbox-panel" aria-label="Caixa de entrada">
              <div className="inbox-heading">
                <strong>Caixa de entrada</strong>
              </div>

              <label className="inbox-search">
                <span>Q</span>
                <input placeholder="Buscar conversa..." />
              </label>

              <div className="inbox-filters">
                <button className="active" type="button">Tudo</button>
                <button type="button">Leads anuncios</button>
                <button type="button">Follow</button>
                <button className="round-action" type="button" aria-label="Nova conversa">+</button>
                <button className="round-action" type="button" aria-label="Mais filtros">v</button>
              </div>

              <div className="conversation-list">
                {conversationContacts.map((contact) => (
                  <button
                    className={`conversation-contact ${selectedConversation.id === contact.id ? "active" : ""}`}
                    key={contact.id}
                    type="button"
                    onClick={() => setSelectedConversationId(contact.id)}
                  >
                    <span className="contact-avatar">{contact.initials}</span>
                    <span className="contact-copy">
                      <strong>{contact.name}</strong>
                      <small>{contact.preview}</small>
                    </span>
                    <span className="contact-meta">
                      <small>{contact.time}</small>
                      {contact.unread ? <b>{contact.unread}</b> : null}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <article className="chat-panel" aria-label={`Conversa com ${selectedConversation.name}`}>
              <header className="chat-header">
                <div className="chat-person">
                  <span className="contact-avatar large">{selectedConversation.initials}</span>
                  <div>
                    <strong>{selectedConversation.name}</strong>
                    <small>{selectedConversation.channel}</small>
                  </div>
                </div>

                <div className="chat-actions">
                  <button className="pilot" type="button">Piloto: Superadmin</button>
                  <button type="button">Devolver para IA</button>
                  <button className="assumed" type="button">Assumido</button>
                </div>
              </header>

              <div className="chat-messages">
                {activeConversationMessages.map((message) => (
                  <div className={`chat-bubble ${message.author}`} key={message.id}>
                    {message.sender ? <strong>{message.sender}</strong> : null}
                    <p>{message.text}</p>
                    <span>{message.time}</span>
                  </div>
                ))}
              </div>

              <form className="message-composer">
                <button type="button" aria-label="Abrir acoes">v</button>
                <input placeholder="Digite sua mensagem..." />
                <button type="button" aria-label="Anexar">+</button>
                <button type="submit">Enviar</button>
              </form>
            </article>
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
          </article>

          <article id="agenda" className={`panel agenda-panel ${activePage === "agenda" ? "" : "page-hidden"}`}>
            <div className="agenda-shell">
              <aside className="agenda-side">
                <div className="section-title">
                  <span className="eyebrow">Agenda interna</span>
                  <h2>Disponibilidade real</h2>
                </div>
                <p className="agenda-status">{calendarStatus}</p>

                <div className="agenda-mini-card">
                  <strong>Proximos horarios livres</strong>
                  {nextCalendarSlots.length ? (
                    nextCalendarSlots.map((slot) => (
                      <div className="agenda-free-slot" key={`${slot.startsAt}-${slot.endsAt}`}>
                        <span>{slot.label}</span>
                        <b>{formatAgendaTime(slot.startsAt)}</b>
                      </div>
                    ))
                  ) : (
                    <span className="agenda-empty-state">Nenhum horario livre encontrado.</span>
                  )}
                </div>

                <div className="agenda-mini-card">
                  <strong>Como o agente usa</strong>
                  <span>Consulta esta agenda, oferece os horarios livres mais proximos e grava a reuniao no banco.</span>
                </div>
              </aside>

              <div className="agenda-calendar">
                <header className="agenda-calendar-toolbar">
                  <button type="button" onClick={handleAgendaToday}>Hoje</button>
                  <button type="button" aria-label="Semana anterior" onClick={() => handleAgendaWeekOffset(-1)}>
                    &lt;
                  </button>
                  <h2>{agendaMonthRange}</h2>
                  <button type="button" aria-label="Proxima semana" onClick={() => handleAgendaWeekOffset(1)}>
                    &gt;
                  </button>
                  <span>Semana</span>
                </header>

                <div className="agenda-week-header">
                  <span />
                  {agendaWeekDays.map((day) => (
                    <div className={isSameAgendaDay(day, new Date()) ? "today" : ""} key={day.toISOString()}>
                      <small>{formatAgendaDay(day)}</small>
                      <strong>{day.getDate()}</strong>
                    </div>
                  ))}
                </div>

                <div className="agenda-week-grid">
                  <div className="agenda-hour-column">
                    {calendarHours.map((hour) => (
                      <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
                    ))}
                  </div>

                  {calendarEventsByDay.map(({ day, events }) => (
                    <div className="agenda-day-column" key={day.toISOString()}>
                      {calendarHours.map((hour) => (
                        <span className="agenda-hour-line" key={hour} />
                      ))}

                      {events.map((event) => {
                        const start = new Date(event.startsAt);
                        const top = Math.max(0, (start.getHours() - 8) * 52 + start.getMinutes() * 0.86);

                        return (
                          <button
                            className={`agenda-event ${
                              selectedCalendarAppointmentId === event.id ? "selected" : ""
                            }`}
                            key={event.id}
                            style={{ top }}
                            type="button"
                            onClick={() => {
                              setSelectedCalendarAppointmentId(event.id);
                              setIsEditingAppointment(false);
                              setAppointmentActionStatus("");
                            }}
                          >
                            <strong>{event.leadName}</strong>
                            <small>{event.responsibleName}</small>
                            <span>
                              {formatAgendaTime(event.startsAt)} - {formatAgendaTime(event.endsAt)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedCalendarAppointment ? (
              <div
                className="appointment-modal-backdrop"
                role="presentation"
                onClick={() => setSelectedCalendarAppointmentId(null)}
              >
                <section
                  className="appointment-detail-modal"
                  aria-label="Detalhes do agendamento"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header>
                    <div>
                      <span className="eyebrow">Agendamento confirmado</span>
                      <h2>{selectedCalendarAppointment.leadName}</h2>
                      <p>{selectedCalendarAppointment.responsibleName}</p>
                    </div>
                    <div className="appointment-modal-actions">
                      <button
                        className="appointment-icon-button"
                        type="button"
                        aria-label="Editar data e horario"
                        title="Editar data e horario"
                        onClick={() => handleStartAppointmentEdit(selectedCalendarAppointment)}
                      >
                        Editar
                      </button>
                      <button
                        className="appointment-icon-button danger"
                        type="button"
                        aria-label="Apagar agendamento"
                        title="Apagar agendamento"
                        onClick={() => handleDeleteAppointment(selectedCalendarAppointment)}
                      >
                        Apagar
                      </button>
                      <button
                        className="appointment-icon-button"
                        type="button"
                        aria-label="Fechar detalhes"
                        title="Fechar"
                        onClick={() => setSelectedCalendarAppointmentId(null)}
                      >
                        x
                      </button>
                    </div>
                  </header>

                  {isEditingAppointment ? (
                    <div className="appointment-edit-panel">
                      <label>
                        <span>Nova data</span>
                        <input
                          type="date"
                          value={appointmentEditDate}
                          onChange={(event) => setAppointmentEditDate(event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Novo horario</span>
                        <input
                          type="time"
                          value={appointmentEditTime}
                          onChange={(event) => setAppointmentEditTime(event.target.value)}
                        />
                      </label>
                      <div className="appointment-edit-actions">
                        <button type="button" onClick={() => handleSaveAppointmentEdit(selectedCalendarAppointment)}>
                          Salvar
                        </button>
                        <button className="secondary" type="button" onClick={() => setIsEditingAppointment(false)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="appointment-detail-grid">
                    <div>
                      <span>Responsavel</span>
                      <strong>{selectedCalendarAppointment.responsibleName}</strong>
                    </div>
                    <div>
                      <span>Autoescola</span>
                      <strong>{selectedCalendarAppointment.leadName}</strong>
                    </div>
                    <div>
                      <span>Data</span>
                      <strong>
                        {new Intl.DateTimeFormat("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        }).format(new Date(selectedCalendarAppointment.startsAt))}
                      </strong>
                    </div>
                    <div>
                      <span>Horario</span>
                      <strong>
                        {formatAgendaTime(selectedCalendarAppointment.startsAt)} -{" "}
                        {formatAgendaTime(selectedCalendarAppointment.endsAt)}
                      </strong>
                    </div>
                    <div>
                      <span>Telefone</span>
                      <strong>{selectedCalendarAppointment.phone}</strong>
                    </div>
                    <div>
                      <span>Trafego pago</span>
                      <strong>
                        {selectedCalendarAppointment.runsPaidTraffic === null
                          ? "Nao informado"
                          : selectedCalendarAppointment.runsPaidTraffic
                            ? "Sim"
                            : "Nao"}
                      </strong>
                    </div>
                    <div>
                      <span>Dor / desejo principal</span>
                      <strong>{selectedCalendarAppointment.mainPain ?? "Nao informado"}</strong>
                    </div>
                    <div>
                      <span>Cidade</span>
                      <strong>{selectedCalendarAppointment.city ?? "Nao informado"}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{selectedCalendarAppointment.status}</strong>
                    </div>
                  </div>
                  {appointmentActionStatus ? <p className="appointment-action-status">{appointmentActionStatus}</p> : null}
                </section>
              </div>
            ) : null}
          </article>

          <article className={`commercial-ai-panel ${activePage === "iaComercial" ? "" : "page-hidden"}`}>
            <section className="commercial-ai-hero">
              <div>
                <span className="eyebrow">IA comercial</span>
                <h2>Prompts e operacao dos agentes</h2>
                <p>
                  Configure a direcao dos agentes que qualificam, consultam agenda, fazem follow-up e acionam humano.
                </p>
              </div>
              <span>Ambiente operacional</span>
            </section>

            <section className="agent-prompt-grid" aria-label="Prompts dos agentes comerciais">
              {commercialAgentPrompts.map((agent) => (
                <article className={`agent-prompt-card ${agent.tone}`} key={agent.id}>
                  <header>
                    <div>
                      <span>{agent.label}</span>
                      <h3>{agent.title}</h3>
                      <p>{agent.description}</p>
                    </div>
                    <b>{agent.badge}</b>
                  </header>
                  <label>
                    <span>{agent.role}</span>
                    <textarea readOnly value={agent.prompt} />
                  </label>
                </article>
              ))}
            </section>

            <section className="commercial-ai-tags">
              <article>
                <header>
                  <span className="eyebrow">Tags de qualificacao</span>
                  <h3>Contexto para o SDR</h3>
                </header>
                <div className="ai-tag-list">
                  {qualificationTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>

              <article>
                <header>
                  <span className="eyebrow">Tags de follow-up</span>
                  <h3>Acompanhamento comercial</h3>
                </header>
                <div className="ai-tag-list follow">
                  {followUpTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>
            </section>

            <section className="commercial-ai-ops">
              <article>
                <span className="eyebrow">Controle WhatsApp</span>
                <h3>IA ativa</h3>
                <p>Pausa geral para impedir novas respostas automaticas no WhatsApp.</p>
                <button type="button">Pausar IA no WhatsApp</button>
              </article>

              <article>
                <span className="eyebrow">Teste interno</span>
                <h3>Chat de teste da IA</h3>
                <textarea readOnly value="Simule uma pergunta do lead para validar o prompt antes de testar no WhatsApp real." />
                <div className="commercial-ai-testbar">
                  <input placeholder="Digite uma mensagem de teste..." />
                  <button type="button">Enviar</button>
                </div>
              </article>

              <article>
                <span className="eyebrow">Notificacoes</span>
                <h3>Teste WhatsApp interno</h3>
                <p>Escolha um numero cadastrado para testar individualmente.</p>
                <button type="button">Escolher numero para teste</button>
              </article>
            </section>
          </article>

          <article className={`panel integrations-panel ${activePage === "integracoes" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">Conexoes</span>
              <h2>Chaves de API</h2>
            </div>

            <form className="integration-form" onSubmit={handleSaveIntegrations}>
              <div className="integration-summary">
                <div>
                  <strong>{filledIntegrationCount}/{integrationFields.length}</strong>
                  <span>campos preenchidos</span>
                </div>
                <div>
                  <strong>{integrationSaved ? "Pronto" : "Pendente"}</strong>
                  <span>persistencia</span>
                </div>
              </div>
              <p className="integration-status">{integrationPersistenceStatus}</p>

              <div className="integration-groups">
                {integrationGroups.map((group) => (
                  <section className="integration-group" key={group.title}>
                    <header>
                      <div>
                        <strong>{group.title}</strong>
                        <span>{group.description}</span>
                      </div>
                      <div className="integration-group-actions">
                        <b>
                          {
                            group.fields.filter(
                              (field) => integrationValues[field.key].trim() || savedIntegrationSecrets[field.key],
                            ).length
                          }
                          /
                          {group.fields.length}
                        </b>
                        <button type="button" onClick={() => handleValidateIntegration(group)}>
                          Validar
                        </button>
                      </div>
                    </header>

                    <div className="integration-fields">
                      {group.fields.map((field) => (
                        <label className="integration-field" key={field.key}>
                          <span>{field.label}</span>
                          <input
                            name={field.key}
                            onChange={(event) => handleIntegrationChange(field.key, event.target.value)}
                            placeholder={savedIntegrationSecrets[field.key] ? "Configurado no servidor" : field.placeholder}
                            type={field.type ?? "text"}
                            value={integrationValues[field.key]}
                          />
                          {savedIntegrationSecrets[field.key] ? <small>Valor salvo sem exibir a chave.</small> : null}
                        </label>
                      ))}
                    </div>

                    {group.id === "evolution" ? (
                      <div className="evolution-tools">
                        <label className="integration-field">
                          <span>Webhook para colocar na Evolution</span>
                          <input readOnly value={webhookUrl} />
                        </label>
                        <button className="secondary" type="button" onClick={handleCopyWebhook}>
                          {webhookCopied ? "Webhook copiado" : "Copiar webhook"}
                        </button>

                        <div className="evolution-test">
                          <label className="integration-field">
                            <span>Numero para teste</span>
                            <input
                              onChange={(event) => setEvolutionTestPhone(event.target.value)}
                              placeholder="5571999999999"
                              value={evolutionTestPhone}
                            />
                          </label>
                          <label className="integration-field">
                            <span>Mensagem de teste</span>
                            <input
                              onChange={(event) => setEvolutionTestMessage(event.target.value)}
                              placeholder="Mensagem de teste"
                              value={evolutionTestMessage}
                            />
                          </label>
                          <button type="button" onClick={handleSendEvolutionTest}>
                            Enviar teste
                          </button>
                        </div>

                        {evolutionTestStatus ? <p className="integration-status">{evolutionTestStatus}</p> : null}
                      </div>
                    ) : null}

                    {integrationValidation[group.id] ? (
                      <p className="integration-status">{integrationValidation[group.id]}</p>
                    ) : null}
                  </section>
                ))}
              </div>

              <section className="env-preview">
                <div>
                  <strong>Arquivo .env para EasyPanel</strong>
                  <span>Use uma variavel por linha ou campo separado no painel.</span>
                </div>
                <textarea readOnly value={envPreview} />
              </section>

              <div className="integration-actions">
                <button type="submit">Validar campos</button>
                <button className="secondary" type="button" onClick={handleCopyEnv}>
                  {envCopied ? "Copiado" : "Copiar .env"}
                </button>
              </div>
            </form>
          </article>
        </section>
      </section>
    </main>
  );
}
