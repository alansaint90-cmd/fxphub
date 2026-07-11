"use client";

import type { CSSProperties, DragEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { ActiveClientsWorkspace } from "@/components/active-clients-workspace";
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
type AppPage =
  | "dashboard"
  | "funil"
  | "clientes"
  | "conversas"
  | "agenda"
  | "iaComercial"
  | "customerSuccess"
  | "implantacoes"
  | "tarefas"
  | "financeiro"
  | "integracoes"
  | "usuarios"
  | "empresa";

const navSections: { title: string; pages: { id: AppPage; label: string; badge?: number }[] }[] = [
  {
    title: "CRM Comercial",
    pages: [
      { id: "dashboard", label: "Dashboard" },
      { id: "funil", label: "Funil" },
      { id: "clientes", label: "Clientes" },
      { id: "conversas", label: "Conversas" },
      { id: "agenda", label: "Agenda" },
      { id: "iaComercial", label: "IA Comercial" },
    ],
  },
  {
    title: "Gestao FXP",
    pages: [
      { id: "customerSuccess", label: "Customer Success" },
      { id: "implantacoes", label: "Implantacoes" },
      { id: "tarefas", label: "Tarefas", badge: 3 },
      { id: "financeiro", label: "Financeiro" },
    ],
  },
  {
    title: "Configuracoes",
    pages: [
      { id: "integracoes", label: "Integracoes" },
      { id: "usuarios", label: "Usuarios" },
      { id: "empresa", label: "Empresa" },
    ],
  },
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

const executiveMetrics = [
  { label: "Receita recorrente", value: "R$ 28.400" },
  { label: "Clientes ativos", value: "18" },
  { label: "Implantacoes em andamento", value: "6" },
  { label: "Reunioes hoje", value: "4" },
  { label: "Follow-ups pendentes", value: "12" },
  { label: "Sem contato +7 dias", value: "3" },
  { label: "Chamados em aberto", value: "5" },
  { label: "Clientes para renovacao", value: "2" },
  { label: "Taxa de conversao", value: "31%" },
  { label: "MRR", value: "R$ 28.400" },
];

const customerSuccessClients = [
  {
    id: "cfc-catuense",
    company: "CFC Catuense",
    responsible: "Alan Nascimento",
    plan: "Growth IA",
    implementationStatus: "Operando",
    health: "Saudavel",
    healthTone: "green",
    implementationDate: "03/07/2026",
    lastContact: "09/07/2026",
    nextContact: "15/07/2026",
    owner: "Customer Success FXP",
    aiRunning: "Sim",
    whatsappConnected: "Sim",
    trainingDone: "Sim",
    lastFeedback: "Atendimento automatizado gerando respostas no WhatsApp.",
    nextRenewal: "03/08/2026",
    nps: 9,
    notes: "Cliente em acompanhamento de performance e ajustes finos do prompt.",
  },
  {
    id: "auto-guia",
    company: "Auto Guia",
    responsible: "Marcio Santos",
    plan: "Start",
    implementationStatus: "Treinamento",
    health: "Atencao",
    healthTone: "yellow",
    implementationDate: "08/07/2026",
    lastContact: "08/07/2026",
    nextContact: "11/07/2026",
    owner: "Implantacao FXP",
    aiRunning: "Sim",
    whatsappConnected: "Sim",
    trainingDone: "Nao",
    lastFeedback: "Equipe pediu reforco no uso da central de atendimento.",
    nextRenewal: "08/08/2026",
    nps: 7,
    notes: "Priorizar treinamento e validacao de rotina comercial.",
  },
  {
    id: "direcao-norte",
    company: "Direcao Norte",
    responsible: "Renata Lima",
    plan: "Performance",
    implementationStatus: "Integracoes",
    health: "Critico",
    healthTone: "red",
    implementationDate: "05/07/2026",
    lastContact: "06/07/2026",
    nextContact: "10/07/2026",
    owner: "CS Senior",
    aiRunning: "Nao",
    whatsappConnected: "Nao",
    trainingDone: "Nao",
    lastFeedback: "Aguardando chave da Evolution e validacao do numero.",
    nextRenewal: "05/08/2026",
    nps: 5,
    notes: "Risco por pendencia tecnica. Acionar suporte e responsavel comercial.",
  },
];

const customerSuccessTimeline = [
  { type: "Reuniao", title: "Alinhamento de implantacao", date: "09/07/2026 14:00", summary: "Revisao de metas, WhatsApp e rotina de atendimento." },
  { type: "Treinamento", title: "Central de Atendimento", date: "08/07/2026 16:30", summary: "Equipe orientada sobre assumir conversa e devolver para IA." },
  { type: "Feedback", title: "Primeira semana", date: "07/07/2026 10:15", summary: "Cliente pediu mensagens mais objetivas para agendamento." },
  { type: "Chamado", title: "Validar Evolution", date: "06/07/2026 09:40", summary: "Checar webhook, instancia e envio de teste." },
  { type: "Renovacao", title: "Proxima recorrencia", date: "03/08/2026", summary: "Conta ativa para renovacao mensal." },
];

const implementationStages = [
  "Contrato Assinado",
  "Pagamento Confirmado",
  "Implantacao",
  "Integracoes",
  "Treinamento",
  "Operando",
  "Acompanhamento",
  "Concluido",
] as const;

const implementationChecklist = [
  "Criar conta",
  "Configurar IA",
  "Conectar WhatsApp",
  "Configurar Prompt",
  "Configurar CRM",
  "Configurar usuarios",
  "Testar integracao",
  "Validar funcionamento",
  "Treinamento realizado",
  "Cliente aprovado",
];

const implementationCards = [
  {
    id: "impl-catuense",
    stage: "Operando",
    company: "CFC Catuense",
    responsible: "Alan Nascimento",
    plan: "Growth IA",
    date: "03/07/2026",
    owner: "Fausto Ops",
    completed: 8,
  },
  {
    id: "impl-auto-guia",
    stage: "Treinamento",
    company: "Auto Guia",
    responsible: "Marcio Santos",
    plan: "Start",
    date: "08/07/2026",
    owner: "CS FXP",
    completed: 6,
  },
  {
    id: "impl-direcao",
    stage: "Integracoes",
    company: "Direcao Norte",
    responsible: "Renata Lima",
    plan: "Performance",
    date: "05/07/2026",
    owner: "Suporte FXP",
    completed: 4,
  },
  {
    id: "impl-liberdade",
    stage: "Pagamento Confirmado",
    company: "Autoescola Liberdade",
    responsible: "Lauro Freitas",
    plan: "Growth IA",
    date: "10/07/2026",
    owner: "Implantacao FXP",
    completed: 2,
  },
] satisfies {
  id: string;
  stage: (typeof implementationStages)[number];
  company: string;
  responsible: string;
  plan: string;
  date: string;
  owner: string;
  completed: number;
}[];

const operationalTasks = [
  { title: "Validar WhatsApp CFC Catuense", description: "Confirmar instancia, webhook e resposta automatica.", responsible: "Suporte FXP", priority: "Alta", dueDate: "10/07/2026", category: "Implantacao", status: "Em andamento" },
  { title: "Follow-up Auto Guia", description: "Agendar treinamento da equipe comercial.", responsible: "CS FXP", priority: "Media", dueDate: "11/07/2026", category: "Customer Success", status: "A Fazer" },
  { title: "Conferir mensalidade Direcao Norte", description: "Validar vencimento e forma de pagamento.", responsible: "Financeiro", priority: "Alta", dueDate: "09/07/2026", category: "Financeiro", status: "Atrasado" },
  { title: "Ajuste de prompt SDR", description: "Refinar abordagem para horarios alternativos.", responsible: "Desenvolvimento", priority: "Baixa", dueDate: "12/07/2026", category: "Desenvolvimento", status: "Concluido" },
];

const financeRows = [
  { company: "CFC Catuense", plan: "Growth IA", amount: 1490, dueDate: "03/08/2026", status: "Pago", responsible: "Alan Nascimento", paymentMethod: "Pix recorrente" },
  { company: "Auto Guia", plan: "Start", amount: 890, dueDate: "08/08/2026", status: "Pendente", responsible: "Marcio Santos", paymentMethod: "Boleto" },
  { company: "Direcao Norte", plan: "Performance", amount: 1890, dueDate: "09/07/2026", status: "Atrasado", responsible: "Renata Lima", paymentMethod: "Cartao" },
  { company: "Autoescola Liberdade", plan: "Growth IA", amount: 1490, dueDate: "10/08/2026", status: "Renovado", responsible: "Lauro Freitas", paymentMethod: "Pix" },
];

const financeMetrics = [
  { label: "MRR", value: "R$ 28.400" },
  { label: "Receita do mes", value: "R$ 34.180" },
  { label: "Clientes ativos", value: "18" },
  { label: "Mensalidades vencendo", value: "6" },
  { label: "Mensalidades atrasadas", value: "2" },
  { label: "Renovacoes do mes", value: "5" },
  { label: "Ticket medio", value: "R$ 1.577" },
  { label: "Novos clientes", value: "4" },
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
  const [selectedCustomerSuccessId, setSelectedCustomerSuccessId] = useState(customerSuccessClients[0]?.id ?? "");
  const [isCustomerServiceModalOpen, setIsCustomerServiceModalOpen] = useState(false);
  const [selectedImplementationId, setSelectedImplementationId] = useState<string | null>(null);
  const [taskCategoryFilter, setTaskCategoryFilter] = useState("Todos");
  const [taskStatusFilter, setTaskStatusFilter] = useState("Todos");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("Todos");
  const [taskResponsibleFilter, setTaskResponsibleFilter] = useState("Todos");
  const [financeStatusFilter, setFinanceStatusFilter] = useState("Todos");

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
  const selectedCustomerSuccess =
    customerSuccessClients.find((client) => client.id === selectedCustomerSuccessId) ?? customerSuccessClients[0];
  const selectedImplementation =
    implementationCards.find((implementation) => implementation.id === selectedImplementationId) ?? null;
  const taskFilterOptions = {
    responsible: ["Todos", ...Array.from(new Set(operationalTasks.map((task) => task.responsible)))],
    category: ["Todos", "Comercial", "Customer Success", "Implantacao", "Desenvolvimento", "Financeiro", "Marketing"],
    status: ["Todos", "A Fazer", "Em andamento", "Concluido", "Atrasado"],
    priority: ["Todos", "Alta", "Media", "Baixa"],
  };
  const filteredTasks = operationalTasks.filter((task) => {
    const matchesResponsible = taskResponsibleFilter === "Todos" || task.responsible === taskResponsibleFilter;
    const matchesCategory = taskCategoryFilter === "Todos" || task.category === taskCategoryFilter;
    const matchesStatus = taskStatusFilter === "Todos" || task.status === taskStatusFilter;
    const matchesPriority = taskPriorityFilter === "Todos" || task.priority === taskPriorityFilter;
    return matchesResponsible && matchesCategory && matchesStatus && matchesPriority;
  });
  const filteredFinanceRows =
    financeStatusFilter === "Todos" ? financeRows : financeRows.filter((row) => row.status === financeStatusFilter);
  const taskDashboard = [
    { label: "Hoje", value: operationalTasks.filter((task) => task.dueDate === "10/07/2026").length },
    { label: "Esta semana", value: operationalTasks.length },
    { label: "Atrasadas", value: operationalTasks.filter((task) => task.status === "Atrasado").length },
    { label: "Concluidas", value: operationalTasks.filter((task) => task.status === "Concluido").length },
  ];

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
          {navSections.map((section) => (
            <div className="nav-section" key={section.title}>
              {section.pages.map((page) => (
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
            </div>
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

        <div className={activePage === "clientes" ? "" : "page-hidden"}>
          <ActiveClientsWorkspace />
        </div>
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
          <article className={`panel executive-panel ${activePage === "dashboard" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">Painel Executivo FXP</span>
              <h2>Indicadores em tempo real</h2>
            </div>
            <div className="executive-grid">
              {executiveMetrics.map((metric) => (
                <div className="executive-metric" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          </article>

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

          <article className={`panel ops-panel ${activePage === "customerSuccess" ? "" : "page-hidden"}`}>
            <div className="ops-layout">
              <section className="ops-main">
                <div className="section-title">
                  <span className="eyebrow">Customer Success</span>
                  <h2>Acompanhamento pos-venda</h2>
                </div>

                <div className="cs-card-grid">
                  {customerSuccessClients.map((client) => (
                    <button
                      className={`cs-card ${selectedCustomerSuccess?.id === client.id ? "active" : ""}`}
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedCustomerSuccessId(client.id)}
                    >
                      <div className="cs-card-head">
                        <div>
                          <strong>{client.company}</strong>
                          <span>{client.responsible}</span>
                        </div>
                        <b className={`health-badge ${client.healthTone}`}>{client.health}</b>
                      </div>
                      <div className="cs-card-meta">
                        <span>Plano: {client.plan}</span>
                        <span>Status: {client.implementationStatus}</span>
                        <span>Proximo contato: {client.nextContact}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedCustomerSuccess ? (
                  <section className="ops-detail-card">
                    <header>
                      <div>
                        <span className="eyebrow">Cliente selecionado</span>
                        <h3>{selectedCustomerSuccess.company}</h3>
                      </div>
                      <button type="button" onClick={() => setIsCustomerServiceModalOpen(true)}>
                        Registrar Atendimento
                      </button>
                    </header>
                    <div className="ops-detail-grid">
                      <span><b>Responsavel</b>{selectedCustomerSuccess.responsible}</span>
                      <span><b>Plano contratado</b>{selectedCustomerSuccess.plan}</span>
                      <span><b>Ultimo contato</b>{selectedCustomerSuccess.lastContact}</span>
                      <span><b>Responsavel interno</b>{selectedCustomerSuccess.owner}</span>
                      <span><b>IA funcionando</b>{selectedCustomerSuccess.aiRunning}</span>
                      <span><b>WhatsApp conectado</b>{selectedCustomerSuccess.whatsappConnected}</span>
                      <span><b>Treinamento realizado</b>{selectedCustomerSuccess.trainingDone}</span>
                      <span><b>Proxima renovacao</b>{selectedCustomerSuccess.nextRenewal}</span>
                      <span><b>NPS</b>{selectedCustomerSuccess.nps}</span>
                      <span className="wide"><b>Ultimo feedback</b>{selectedCustomerSuccess.lastFeedback}</span>
                      <span className="wide"><b>Observacoes</b>{selectedCustomerSuccess.notes}</span>
                    </div>
                  </section>
                ) : null}
              </section>

              <aside className="ops-timeline">
                <div className="section-title">
                  <span className="eyebrow">Timeline</span>
                  <h2>Historico do cliente</h2>
                </div>
                {customerSuccessTimeline.map((item) => (
                  <article className="timeline-item" key={`${item.type}-${item.date}`}>
                    <span>{item.type}</span>
                    <strong>{item.title}</strong>
                    <small>{item.date}</small>
                    <p>{item.summary}</p>
                  </article>
                ))}
              </aside>
            </div>

            {isCustomerServiceModalOpen ? (
              <div className="ops-modal-overlay" role="presentation" onClick={() => setIsCustomerServiceModalOpen(false)}>
                <form className="ops-modal" onClick={(event) => event.stopPropagation()}>
                  <header>
                    <h3>Registrar Atendimento</h3>
                    <button type="button" onClick={() => setIsCustomerServiceModalOpen(false)}>x</button>
                  </header>
                  <label>
                    <span>Tipo de atendimento</span>
                    <select defaultValue="Reuniao">
                      <option>Ligacao</option>
                      <option>Reuniao</option>
                      <option>Treinamento</option>
                      <option>Feedback</option>
                      <option>Chamado</option>
                      <option>Observacao</option>
                      <option>Renovacao</option>
                    </select>
                  </label>
                  <label>
                    <span>Resumo</span>
                    <textarea placeholder="Resumo do atendimento" rows={4} />
                  </label>
                  <label>
                    <span>Proxima acao</span>
                    <input placeholder="Ex: acompanhar configuracao do WhatsApp" />
                  </label>
                  <label>
                    <span>Proxima data de contato</span>
                    <input type="date" />
                  </label>
                  <footer>
                    <button type="button" onClick={() => setIsCustomerServiceModalOpen(false)}>Salvar atendimento</button>
                  </footer>
                </form>
              </div>
            ) : null}
          </article>

          <article className={`panel ops-panel ${activePage === "implantacoes" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">Pipeline de implantacao</span>
              <h2>Implantacoes</h2>
            </div>
            <div className="implementation-board">
              {implementationStages.map((stage) => {
                const stageCards = implementationCards.filter((card) => card.stage === stage);

                return (
                  <section className="implementation-column" key={stage}>
                    <header>
                      <span>{stage}</span>
                      <b>{stageCards.length}</b>
                    </header>
                    <div className="implementation-list">
                      {stageCards.map((card) => {
                        const progress = Math.round((card.completed / implementationChecklist.length) * 100);
                        return (
                          <button className="implementation-card" key={card.id} type="button" onClick={() => setSelectedImplementationId(card.id)}>
                            <strong>{card.company}</strong>
                            <span>{card.responsible}</span>
                            <small>{card.plan} | {card.date}</small>
                            <small>{card.owner}</small>
                            <div className="progress-line">
                              <i style={{ width: `${progress}%` }} />
                            </div>
                            <b>{progress}% concluido</b>
                          </button>
                        );
                      })}
                      {stageCards.length === 0 ? <div className="kanban-empty">Sem clientes</div> : null}
                    </div>
                  </section>
                );
              })}
            </div>

            {selectedImplementation ? (
              <div className="ops-modal-overlay" role="presentation" onClick={() => setSelectedImplementationId(null)}>
                <section className="ops-modal checklist-modal" onClick={(event) => event.stopPropagation()}>
                  <header>
                    <div>
                      <h3>{selectedImplementation.company}</h3>
                      <span>{selectedImplementation.responsible} | {selectedImplementation.plan}</span>
                    </div>
                    <button type="button" onClick={() => setSelectedImplementationId(null)}>x</button>
                  </header>
                  <div className="progress-line large">
                    <i style={{ width: `${Math.round((selectedImplementation.completed / implementationChecklist.length) * 100)}%` }} />
                  </div>
                  <div className="checklist-grid">
                    {implementationChecklist.map((item, index) => (
                      <label key={item}>
                        <input checked={index < selectedImplementation.completed} readOnly type="checkbox" />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </article>

          <article className={`panel ops-panel ${activePage === "tarefas" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">Central de tarefas</span>
              <h2>Tarefas</h2>
            </div>
            <div className="task-summary-grid">
              {taskDashboard.map((item) => (
                <div className="executive-metric" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="task-filters">
              <label><span>Responsavel</span><select value={taskResponsibleFilter} onChange={(event) => setTaskResponsibleFilter(event.target.value)}>{taskFilterOptions.responsible.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Categoria</span><select value={taskCategoryFilter} onChange={(event) => setTaskCategoryFilter(event.target.value)}>{taskFilterOptions.category.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Status</span><select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)}>{taskFilterOptions.status.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Prioridade</span><select value={taskPriorityFilter} onChange={(event) => setTaskPriorityFilter(event.target.value)}>{taskFilterOptions.priority.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <div className="ops-table">
              <div className="ops-table-head">
                <span>Titulo</span><span>Responsavel</span><span>Prioridade</span><span>Data limite</span><span>Categoria</span><span>Status</span>
              </div>
              {filteredTasks.map((task) => (
                <article className="ops-table-row" key={task.title}>
                  <div><strong>{task.title}</strong><small>{task.description}</small></div>
                  <span>{task.responsible}</span>
                  <b className={`priority-badge ${task.priority.toLowerCase()}`}>{task.priority}</b>
                  <span>{task.dueDate}</span>
                  <span>{task.category}</span>
                  <span>{task.status}</span>
                </article>
              ))}
            </div>
          </article>

          <article className={`panel ops-panel ${activePage === "financeiro" ? "" : "page-hidden"}`}>
            <div className="section-title">
              <span className="eyebrow">Financeiro</span>
              <h2>Receita e mensalidades</h2>
            </div>
            <div className="finance-metric-grid">
              {financeMetrics.map((metric) => (
                <div className="executive-metric" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
            <div className="finance-filters">
              {["Todos", "Pago", "Pendente", "Atrasado", "Renovado"].map((status) => (
                <button className={financeStatusFilter === status ? "active" : ""} key={status} type="button" onClick={() => setFinanceStatusFilter(status)}>
                  {status}
                </button>
              ))}
            </div>
            <div className="ops-table">
              <div className="ops-table-head finance">
                <span>Empresa</span><span>Plano</span><span>Valor</span><span>Vencimento</span><span>Status</span><span>Responsavel</span><span>Pagamento</span>
              </div>
              {filteredFinanceRows.map((row) => (
                <article className="ops-table-row finance" key={`${row.company}-${row.dueDate}`}>
                  <strong>{row.company}</strong>
                  <span>{row.plan}</span>
                  <span>{formatCurrency(row.amount)}</span>
                  <span>{row.dueDate}</span>
                  <b className={`finance-status ${row.status.toLowerCase()}`}>{row.status}</b>
                  <span>{row.responsible}</span>
                  <span>{row.paymentMethod}</span>
                </article>
              ))}
            </div>
          </article>

          <article className={`panel ops-panel settings-placeholder ${activePage === "usuarios" ? "" : "page-hidden"}`}>
            <span className="eyebrow">Configuracoes</span>
            <h2>Usuarios</h2>
            <p>Area preparada para perfis, permissoes e acessos da equipe FXP.</p>
          </article>

          <article className={`panel ops-panel settings-placeholder ${activePage === "empresa" ? "" : "page-hidden"}`}>
            <span className="eyebrow">Configuracoes</span>
            <h2>Empresa</h2>
            <p>Area preparada para dados da FXP, padroes comerciais e parametros operacionais.</p>
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
