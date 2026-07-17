export type DiagnosticLeadStatus = "HOT" | "WARM" | "DISQUALIFIED";

export interface LeadCaptureScoringInput {
  name: string;
  businessName: string;
  phone?: string;
  role: string;
  paidTraffic: string;
  paidTrafficReason?: string;
  currentDailyLeads: string;
  desiredDailyLeads: string;
  attendanceStructure: string;
  responseTime: string;
  mainChallenge: string;
  strategyOpenness: string;
  meetingInterest: string;
}

export interface LeadCaptureScoreResult {
  score: number;
  status: "qualified" | "unqualified";
  diagnosticStatus: DiagnosticLeadStatus;
  reason: string;
  tags: string[];
  summary: string;
}

const roleScores: Record<string, number> = {
  "Dono(a)": 3,
  "Socio(a)": 3,
  "Gestor(a)": 3,
  "Responsavel pelo marketing ou comercial": 2,
  "Funcionario(a)": 0,
  Outro: 0,
};

const currentLeadScores: Record<string, number> = {
  "Nenhum ou quase nenhum.": 3,
  "1 a 5.": 3,
  "6 a 10.": 2,
  "11 a 20.": 2,
  "Mais de 20.": 1,
};

const responseTimeScores: Record<string, number> = {
  "Imediatamente.": 0,
  "Ate 5 minutos.": 1,
  "Entre 5 e 30 minutos.": 2,
  "Mais de 30 minutos.": 3,
  "As vezes so respondemos horas depois.": 3,
  "Nao sei.": 2,
};

const strategyScores: Record<string, number> = {
  "Sim, estou buscando exatamente isso.": 4,
  "Sim, se fizer sentido para minha realidade.": 3,
  "Talvez, quero entender primeiro.": 1,
  "Nao tenho interesse em mudar minha estrategia atual.": -5,
};

const meetingScores: Record<string, number> = {
  "Sim, quero receber minha analise gratuita.": 5,
  "Tenho interesse, mas preciso combinar outro momento.": 3,
  "Nao tenho interesse em conversar.": -5,
};

export function scoreLeadCapture(input: LeadCaptureScoringInput, _minScore = 12): LeadCaptureScoreResult {
  let score = 0;
  const tags: string[] = [];

  score += roleScores[input.role] ?? 0;
  score += currentLeadScores[input.currentDailyLeads] ?? 0;
  score += input.desiredDailyLeads ? 2 : 0;
  score += responseTimeScores[input.responseTime] ?? 0;
  score += input.mainChallenge ? 2 : 0;
  score += strategyScores[input.strategyOpenness] ?? 0;
  score += meetingScores[input.meetingInterest] ?? 0;

  if (input.paidTraffic === "Sim, utilizamos atualmente.") tags.push("trafego_pago_ativo");
  if (input.paidTraffic === "Ja utilizamos, mas paramos.") tags.push("trafego_pago_interrompido");
  if (input.paidTraffic === "Nunca utilizamos.") tags.push("precisa_geracao_demanda");
  if (isDecisionMaker(input.role)) tags.push("decisor");
  if (hasServiceDelay(input.responseTime)) tags.push("oportunidade_ia_atendimento");
  if (input.mainChallenge) tags.push("dor_comercial_clara");

  const diagnosticStatus = classify(score);
  const validPhone = input.phone ? onlyDigits(input.phone).length >= 10 : true;
  const activeBusiness = input.businessName.trim().length >= 2;
  const noDecisionPower = !isDecisionMaker(input.role);
  const noStrategyInterest = input.strategyOpenness === "Nao tenho interesse em mudar minha estrategia atual.";
  const noMeetingInterest = input.meetingInterest === "Nao tenho interesse em conversar.";

  let finalStatus: DiagnosticLeadStatus = diagnosticStatus;
  const blockingReasons: string[] = [];
  if (!validPhone) blockingReasons.push("Telefone invalido ou incompleto.");
  if (!activeBusiness) blockingReasons.push("Autoescola nao informada.");
  if (noDecisionPower) blockingReasons.push("Lead nao demonstrou poder de decisao.");
  if (noStrategyInterest) blockingReasons.push("Lead nao demonstrou abertura para nova estrategia.");
  if (noMeetingInterest) blockingReasons.push("Lead nao demonstrou interesse em conversar.");
  if (blockingReasons.length > 0) finalStatus = "DISQUALIFIED";

  const status = finalStatus === "DISQUALIFIED" ? "unqualified" : "qualified";
  const reason = blockingReasons[0] ?? reasonFor(finalStatus, score);
  tags.push(`lead_status_${finalStatus.toLowerCase()}`);
  if (status === "qualified") tags.push("fausto_whatsapp_liberado");

  return {
    score,
    status,
    diagnosticStatus: finalStatus,
    reason,
    tags,
    summary: buildDiagnosticSummary(input),
  };
}

export function buildDiagnosticSummary(input: LeadCaptureScoringInput) {
  const trafficContext = input.paidTrafficReason
    ? `${input.paidTraffic.replace(/\.$/, "")}, com motivo/contexto: ${input.paidTrafficReason}`
    : input.paidTraffic.replace(/\.$/, "");

  return [
    `${input.businessName || "Autoescola"} recebe atualmente ${lowerFirst(input.currentDailyLeads)} novos interessados por dia e gostaria de chegar a ${lowerFirst(input.desiredDailyLeads)}`,
    `O atendimento atual funciona com ${lowerFirst(input.attendanceStructure)} e o tempo de resposta costuma ser ${lowerFirst(input.responseTime)}`,
    `O principal desafio informado e ${lowerFirst(input.mainChallenge)}`,
    `${trafficContext}`,
    `Abertura para nova estrategia: ${lowerFirst(input.strategyOpenness)}`,
  ].join(". ");
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function classify(score: number): DiagnosticLeadStatus {
  if (score >= 12) return "HOT";
  if (score >= 7) return "WARM";
  return "DISQUALIFIED";
}

function isDecisionMaker(role: string) {
  return ["Dono(a)", "Socio(a)", "Gestor(a)", "Responsavel pelo marketing ou comercial"].includes(role);
}

function hasServiceDelay(value: string) {
  return ["Entre 5 e 30 minutos.", "Mais de 30 minutos.", "As vezes so respondemos horas depois.", "Nao sei."].includes(value);
}

function reasonFor(status: DiagnosticLeadStatus, score: number) {
  if (status === "HOT") return `Lead HOT com pontuacao ${score}. Perfil aprovado para falar com Fausto.`;
  if (status === "WARM") return `Lead WARM com pontuacao ${score}. Perfil compativel para analise gratuita.`;
  return `Pontuacao abaixo do minimo (${score}/7).`;
}

function lowerFirst(value: string) {
  if (!value) return "nao informado";
  return value.charAt(0).toLowerCase() + value.slice(1);
}
