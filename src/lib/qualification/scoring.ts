import type { PainPoint, QualificationAnswerSet, QualificationResult } from "./types";

const minimumScoreToSchedule = Number(process.env.MINIMUM_SCORE_TO_SCHEDULE ?? 55);

export function calculateQualification(answers: QualificationAnswerSet): QualificationResult {
  let score = 0;
  const painPoints = new Set<PainPoint>();

  if (answers.drivingSchoolName) score += 10;
  if (answers.city) score += 5;

  const monthlyEnrollments = answers.monthlyEnrollments ?? 0;
  if (monthlyEnrollments >= 40) score += 30;
  else if (monthlyEnrollments >= 15) score += 20;
  else if (monthlyEnrollments > 0) score += 10;

  const attendants = answers.commercialAttendants ?? 0;
  if (attendants >= 3) {
    score += 15;
    painPoints.add("falta_de_acompanhamento");
    painPoints.add("falta_de_processo_comercial");
  } else if (attendants > 0) {
    score += 10;
    painPoints.add("equipe_pequena");
    painPoints.add("atendimento_manual");
  }

  if (answers.usesCrm === true) {
    score += 10;
  }

  if (answers.usesCrm === false) {
    score += 15;
    painPoints.add("falta_de_crm");
    painPoints.add("leads_perdidos");
    painPoints.add("atendimento_manual");
  }

  if (answers.runsPaidTraffic === true) {
    score += 20;
    painPoints.add("leads_perdidos");
    painPoints.add("baixa_conversao");
    painPoints.add("demora_no_atendimento");
  }

  if (answers.runsPaidTraffic === false) {
    score += 5;
  }

  const classification = score >= 75 ? "A" : score >= minimumScoreToSchedule ? "B" : "C";
  const canSchedule = classification === "A" || classification === "B";

  return {
    score,
    classification,
    painPoints: [...painPoints],
    summary: buildSummary(answers, [...painPoints]),
    canSchedule,
    nextStage: canSchedule ? "agendamento_em_andamento" : "nao_qualificado",
  };
}

function buildSummary(answers: QualificationAnswerSet, painPoints: PainPoint[]): string {
  const parts = [
    answers.drivingSchoolName ? `Autoescola ${answers.drivingSchoolName}` : "Autoescola sem nome informado",
    answers.commercialAttendants !== undefined
      ? `com ${answers.commercialAttendants} atendente(s)`
      : "com equipe comercial nao informada",
    answers.monthlyEnrollments !== undefined
      ? `media de ${answers.monthlyEnrollments} matriculas por mes`
      : "volume de matriculas nao informado",
    answers.usesCrm === undefined
      ? "CRM nao informado"
      : answers.usesCrm
        ? "utiliza CRM"
        : "nao utiliza CRM",
    answers.runsPaidTraffic === undefined
      ? "trafego pago nao informado"
      : answers.runsPaidTraffic
        ? "investe em trafego pago"
        : "nao investe em trafego pago",
    answers.city ? `localizada em ${answers.city}` : "cidade nao informada",
  ];

  const painText =
    painPoints.length > 0
      ? `Principais dores identificadas: ${painPoints.map(formatPainPoint).join(", ")}.`
      : "Ainda nao ha dores claras identificadas.";

  return `${parts.join(", ")}. ${painText}`;
}

function formatPainPoint(painPoint: PainPoint): string {
  return painPoint.replaceAll("_", " ");
}
