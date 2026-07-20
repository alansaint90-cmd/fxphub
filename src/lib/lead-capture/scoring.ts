export type DiagnosticLeadStatus = "HOT" | "WARM" | "DISQUALIFIED";
export type DiagnosticProfile = "Demanda abaixo do potencial" | "Oportunidades sendo desperdicadas" | "Pronto para acelerar";

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
  diagnostic: PersonalizedDiagnostic;
}

export interface PersonalizedDiagnostic {
  perfil: DiagnosticProfile;
  titulo_diagnostico: string;
  diagnostico: string;
  pontos_criticos: [string, string, string];
  oportunidades: [string, string, string];
  solucao_recomendada: string;
  cta_sugestao: "Falar com Fausto e receber minha analise gratuita";
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
  const diagnostic = buildPersonalizedDiagnostic(input);
  tags.push(`lead_status_${finalStatus.toLowerCase()}`);
  tags.push(`perfil_${slugify(diagnostic.perfil)}`);
  if (status === "qualified") tags.push("fausto_whatsapp_liberado");

  return {
    score,
    status,
    diagnosticStatus: finalStatus,
    reason,
    tags,
    summary: diagnostic.diagnostico,
    diagnostic,
  };
}

export function buildDiagnosticSummary(input: LeadCaptureScoringInput) {
  return buildPersonalizedDiagnostic(input).diagnostico;
}

export function buildPersonalizedDiagnostic(input: LeadCaptureScoringInput): PersonalizedDiagnostic {
  const perfil = chooseDiagnosticProfile(input);
  const firstName = input.name.trim().split(/\s+/)[0] || "Tudo certo";
  const company = input.businessName.trim() || "sua autoescola";
  const currentLeads = lowerFirst(input.currentDailyLeads);
  const desiredLeads = lowerFirst(input.desiredDailyLeads);
  const responseTime = lowerFirst(input.responseTime);
  const challenge = lowerFirst(input.mainChallenge);
  const trafficContext = trafficSentence(input);
  const resultTitle = buildResultTitle(input, perfil);
  const solutionRecommendation = buildSolutionRecommendation(input, perfil);
  const transition = "Com base no seu cenario, identificamos uma oportunidade clara para aumentar a geracao e o aproveitamento de novos clientes na sua autoescola. O proximo passo e entender como essa estrategia pode ser aplicada especificamente a sua operacao.";

  if (perfil === "Demanda abaixo do potencial") {
    return {
      perfil,
      titulo_diagnostico: resultTitle,
      diagnostico: [
        `${firstName}, o diagnostico da ${company} mostra que o principal ponto de atencao esta na entrada de novos interessados. Hoje, sua autoescola recebe ${currentLeads} novos interessados por dia e deseja chegar a ${desiredLeads}. Esse gap indica que existe espaco para criar uma rotina mais previsivel de geracao de oportunidades.`,
        `O desafio informado foi ${challenge}. Nesse cenario, depender apenas da demanda atual pode limitar o volume de conversas comerciais e, consequentemente, o numero de novas matriculas que a equipe consegue buscar.`,
        `${trafficContext} A oportunidade mais clara e estruturar campanhas e geracao de demanda para colocar mais potenciais alunos no WhatsApp, mantendo o atendimento preparado para aproveitar esses contatos.`,
        transition,
      ].join("\n\n"),
      pontos_criticos: [
        `Volume atual de interessados abaixo do objetivo informado: ${input.currentDailyLeads} versus ${input.desiredDailyLeads}`,
        `Desafio principal ligado a aquisicao ou previsibilidade: ${input.mainChallenge}`,
        `Necessidade de transformar o WhatsApp em um canal constante de novas oportunidades`,
      ],
      oportunidades: [
        "Criar campanhas focadas em gerar conversas qualificadas no WhatsApp",
        "Medir o volume de interessados gerados e acompanhar quais viram oportunidade real",
        "Usar IA para qualificar rapidamente os contatos que chegarem pelas campanhas",
      ],
      solucao_recomendada: solutionRecommendation,
      cta_sugestao: "Falar com Fausto e receber minha analise gratuita",
    };
  }

  if (perfil === "Oportunidades sendo desperdicadas") {
    return {
      perfil,
      titulo_diagnostico: resultTitle,
      diagnostico: [
        `${firstName}, a ${company} ja demonstra entrada de interessados, mas o diagnostico indica que parte das oportunidades pode estar sendo perdida no atendimento. Hoje, sua autoescola recebe ${currentLeads} novos interessados por dia e quer chegar a ${desiredLeads}.`,
        `O tempo de resposta informado foi ${responseTime}, e o principal desafio apontado foi ${challenge}. Quando existe demora, falta de acompanhamento ou baixa conversao, o problema deixa de ser apenas gerar mais contatos e passa a ser aproveitar melhor cada conversa que chega.`,
        `${trafficContext} A oportunidade aqui e usar Inteligencia Artificial para apoiar o WhatsApp, responder mais rapido, organizar os interessados e ajudar a equipe a priorizar quem tem maior potencial de matricula.`,
        transition,
      ].join("\n\n"),
      pontos_criticos: [
        `Tempo de resposta com risco de perda de oportunidade: ${input.responseTime}`,
        `Desafio comercial informado: ${input.mainChallenge}`,
        `Necessidade de acompanhar melhor os contatos que ja chegam pelo WhatsApp`,
      ],
      oportunidades: [
        "Reduzir o tempo de primeira resposta com apoio de IA",
        "Qualificar interessados automaticamente antes da abordagem comercial",
        "Organizar follow-up para evitar que conversas quentes sejam esquecidas",
      ],
      solucao_recomendada: solutionRecommendation,
      cta_sugestao: "Falar com Fausto e receber minha analise gratuita",
    };
  }

  return {
    perfil,
    titulo_diagnostico: resultTitle,
    diagnostico: [
      `${firstName}, as respostas da ${company} mostram uma operacao com base para crescer. Hoje, sua autoescola recebe ${currentLeads} novos interessados por dia e deseja chegar a ${desiredLeads}, o que revela uma oportunidade clara de aumentar previsibilidade sem criar novos gargalos.`,
      `O atendimento atual funciona com ${lowerFirst(input.attendanceStructure)} e o tempo de resposta costuma ser ${responseTime}. Como existe abertura para uma nova estrategia, o proximo salto esta em conectar geracao de demanda, acompanhamento e velocidade comercial.`,
      `${trafficContext} Nesse cenario, a estrategia completa da FXP pode combinar campanhas para atrair mais interessados com Inteligencia Artificial apoiando e qualificando as conversas no WhatsApp.`,
      transition,
    ].join("\n\n"),
    pontos_criticos: [
      `Gap entre cenario atual e desejado: ${input.currentDailyLeads} versus ${input.desiredDailyLeads}`,
      `Necessidade de crescer mantendo atendimento e acompanhamento sob controle`,
      `Desafio informado pela empresa: ${input.mainChallenge}`,
    ],
    oportunidades: [
      "Aumentar previsibilidade de demanda com campanhas estruturadas",
      "Usar IA para manter velocidade de atendimento durante o crescimento",
      "Acompanhar melhor as oportunidades ate a decisao de matricula",
    ],
    solucao_recomendada: solutionRecommendation,
    cta_sugestao: "Falar com Fausto e receber minha analise gratuita",
  };
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

function chooseDiagnosticProfile(input: LeadCaptureScoringInput): DiagnosticProfile {
  const demandChallenges = [
    "Poucas pessoas entrando em contato.",
    "Dependencia de indicacao.",
    "Nao temos uma estrategia previsivel para gerar novos alunos.",
  ];
  const wasteChallenges = [
    "Muitos contatos, mas poucas matriculas.",
    "Demora no atendimento.",
    "Falta de acompanhamento dos interessados.",
  ];
  const lowDemand = ["Nenhum ou quase nenhum.", "1 a 5."].includes(input.currentDailyLeads);
  const relevantDemand = ["6 a 10.", "11 a 20.", "Mais de 20."].includes(input.currentDailyLeads);
  const delayedService = hasServiceDelay(input.responseTime);
  const structuredOperation = ["Temos uma equipe de atendimento.", "Temos automacao ou Inteligencia Artificial."].includes(input.attendanceStructure);
  const clearGrowthIntent = ["Sim, estou buscando exatamente isso.", "Sim, se fizer sentido para minha realidade."].includes(input.strategyOpenness);

  if ((relevantDemand && delayedService) || wasteChallenges.includes(input.mainChallenge)) {
    return "Oportunidades sendo desperdicadas";
  }
  if (lowDemand || demandChallenges.includes(input.mainChallenge)) {
    return "Demanda abaixo do potencial";
  }
  if (clearGrowthIntent || structuredOperation || input.paidTraffic === "Sim, utilizamos atualmente.") {
    return "Pronto para acelerar";
  }
  return "Demanda abaixo do potencial";
}

function trafficSentence(input: LeadCaptureScoringInput) {
  if (input.paidTraffic === "Nunca utilizamos.") {
    return "Como a autoescola ainda nao utilizou trafego pago, isso pode ser tratado como uma oportunidade para comecar com uma estrategia estruturada desde o inicio.";
  }
  if (input.paidTraffic === "Ja utilizamos, mas paramos.") {
    const reason = input.paidTrafficReason ? ` O motivo informado foi: ${input.paidTrafficReason}` : "";
    return `A autoescola ja testou trafego pago e interrompeu as campanhas.${reason} Isso mostra que gerar leads, acompanhar o atendimento e medir a transformacao desses contatos em oportunidades precisam caminhar juntos.`;
  }
  if (input.paidTraffic === "Sim, utilizamos atualmente.") {
    const reason = input.paidTrafficReason ? ` O motivo da busca por uma nova solucao foi: ${input.paidTrafficReason}` : "";
    return `A autoescola ja investe em trafego pago.${reason} O ponto agora e integrar melhor geracao de demanda, atendimento e conversao em matriculas.`;
  }
  return input.paidTraffic;
}

function buildSolutionRecommendation(input: LeadCaptureScoringInput, perfil: DiagnosticProfile) {
  const opportunity = classifyResultOpportunity(input, perfil);

  if (opportunity === "demand") {
    return "Seu diagnóstico indica que sua autoescola tem potencial para aumentar a quantidade de potenciais alunos chegando até o seu negócio.\n\nCom uma estratégia de Tráfego Pago mais estruturada, é possível ampliar a geração de novas oportunidades e colocar sua autoescola diante de mais pessoas interessadas em tirar ou adicionar uma categoria na CNH.";
  }

  if (opportunity === "attendance") {
    return "Seu diagnóstico indica que sua autoescola pode aproveitar melhor os potenciais alunos que já entram em contato pelo WhatsApp.\n\nCom processos de atendimento mais rápidos e o apoio da Inteligência Artificial, é possível reduzir oportunidades perdidas e aumentar as chances de transformar mais conversas em matrículas.";
  }

  if (opportunity === "structure") {
    return "Seu diagnóstico mostra que sua autoescola já possui uma estrutura comercial, mas ainda existem oportunidades para potencializar seus resultados.\n\nUma estratégia mais estruturada de Tráfego Pago, aliada à Inteligência Artificial, pode ajudar a aumentar a geração de oportunidades, melhorar o acompanhamento dos contatos e criar um processo mais eficiente de aquisição de novas matrículas.";
  }

  return "Seu diagnóstico indica oportunidades tanto na geração de novos contatos quanto no aproveitamento dos potenciais alunos que chegam até sua autoescola.\n\nUnindo Tráfego Pago + Inteligência Artificial, a FXP pode ajudar a gerar mais oportunidades, melhorar o atendimento e aumentar as chances de transformar interessados em novas matrículas.";
}

function buildResultTitle(input: LeadCaptureScoringInput, perfil: DiagnosticProfile) {
  const opportunity = classifyResultOpportunity(input, perfil);
  if (opportunity === "demand") return "Potencial para gerar mais oportunidades";
  if (opportunity === "attendance") return "Potencial para aproveitar melhor suas oportunidades";
  if (opportunity === "structure") return "Potencial para acelerar seus resultados";
  return "Alto potencial de crescimento";
}

function classifyResultOpportunity(input: LeadCaptureScoringInput, perfil: DiagnosticProfile) {
  const challenge = input.mainChallenge.toLowerCase();
  const needsDemand =
    ["Nenhum ou quase nenhum.", "1 a 5."].includes(input.currentDailyLeads) ||
    ["Nunca utilizamos.", "Ja utilizamos, mas paramos."].includes(input.paidTraffic) ||
    challenge.includes("poucas") ||
    challenge.includes("indicacao") ||
    challenge.includes("previsivel") ||
    perfil === "Demanda abaixo do potencial";
  const needsAttendance =
    hasServiceDelay(input.responseTime) ||
    challenge.includes("demora") ||
    challenge.includes("acompanhamento") ||
    challenge.includes("poucas matriculas") ||
    perfil === "Oportunidades sendo desperdicadas";
  const hasStructure =
    ["Temos uma equipe de atendimento.", "Temos automacao ou Inteligencia Artificial."].includes(input.attendanceStructure) ||
    input.paidTraffic === "Sim, utilizamos atualmente.";

  if (hasStructure && !needsDemand && !needsAttendance) return "structure";
  if (needsDemand && needsAttendance) return "growth";
  if (needsAttendance) return "attendance";
  if (needsDemand) return "demand";
  if (hasStructure) return "structure";
  return "growth";
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
