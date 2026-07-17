export interface LeadCaptureScoringInput {
  name: string;
  businessName: string;
  phone: string;
  monthlyEnrollments: number;
  salesAttendants: number;
  usesCrm: string;
  runsPaidAds: string;
  mainChallenge: string;
  meetingInterest: string;
}

export interface LeadCaptureScoreResult {
  score: number;
  status: "qualified" | "unqualified";
  reason: string;
  tags: string[];
}

const meetingInterestScores: Record<string, number> = {
  "Sim, quero participar de uma reuniao": 30,
  "Tenho interesse, mas ainda nao sei quando": 15,
  "Quero apenas conhecer melhor": 5,
  "Nao tenho interesse em reuniao neste momento": 0,
};

export function scoreLeadCapture(input: LeadCaptureScoringInput, minScore = 50): LeadCaptureScoreResult {
  let score = 0;
  const tags: string[] = [];

  if (input.monthlyEnrollments > 40) score += 30;
  else if (input.monthlyEnrollments >= 21) score += 20;
  else if (input.monthlyEnrollments >= 11) score += 10;

  if (input.salesAttendants >= 2) score += 15;
  else if (input.salesAttendants === 1) score += 10;
  else score += 5;

  if (input.usesCrm === "Nao utiliza CRM") score += 15;
  else if (input.usesCrm === "Utiliza planilha") score += 10;
  else if (input.usesCrm === "Ja utiliza CRM") score += 5;

  if (input.runsPaidAds === "Ja investe em anuncios") score += 20;
  else if (input.runsPaidAds === "Ja investiu anteriormente") score += 10;
  else if (input.runsPaidAds === "Nunca investiu") score += 5;

  score += meetingInterestScores[input.meetingInterest] ?? 0;

  const pain = normalize(input.mainChallenge);
  const painTerms = [
    "demora",
    "lead",
    "perdido",
    "acompanhamento",
    "crm",
    "matricula",
    "sobrecarreg",
    "manual",
    "follow",
  ];
  const matchedPain = painTerms.some((term) => pain.includes(term));
  if (matchedPain) {
    score += 10;
    tags.push("dor_comercial_clara");
  }

  const wantsMeeting = input.meetingInterest === "Sim, quero participar de uma reuniao";
  const validPhone = onlyDigits(input.phone).length >= 10;
  const activeBusiness = input.businessName.trim().length >= 2;

  if (!validPhone) return { score, status: "unqualified", reason: "Telefone invalido ou incompleto.", tags };
  if (!activeBusiness) return { score, status: "unqualified", reason: "Autoescola nao informada.", tags };
  if (!wantsMeeting) return { score, status: "unqualified", reason: "Lead nao demonstrou interesse direto em reuniao.", tags };
  if (score < minScore) return { score, status: "unqualified", reason: `Pontuacao abaixo do minimo (${score}/${minScore}).`, tags };

  tags.push("lead_qualificado", "reuniao_solicitada");
  return { score, status: "qualified", reason: "Perfil aprovado para contato com o Fausto.", tags };
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
