export type QualificationQuestionId =
  | "responsibleName"
  | "drivingSchoolName"
  | "monthlyEnrollments"
  | "commercialAttendants"
  | "usesCrm"
  | "runsPaidTraffic"
  | "city"
  | "mainPain";

export type LeadClassification = "A" | "B" | "C";

export type PainPoint =
  | "demora_no_atendimento"
  | "leads_perdidos"
  | "falta_de_crm"
  | "equipe_pequena"
  | "atendimento_manual"
  | "falta_de_acompanhamento"
  | "falta_de_processo_comercial"
  | "baixa_conversao";

export type FunnelStage =
  | "novo_lead"
  | "ia_atendendo"
  | "qualificado"
  | "nao_qualificado"
  | "agendamento_em_andamento"
  | "reuniao_agendada";

export interface QualificationAnswerSet {
  responsibleName?: string;
  drivingSchoolName?: string;
  monthlyEnrollments?: number;
  commercialAttendants?: number;
  usesCrm?: boolean;
  runsPaidTraffic?: boolean;
  city?: string;
  mainPain?: string;
}

export interface QualificationQuestion {
  id: QualificationQuestionId;
  prompt: string;
}

export interface QualificationResult {
  score: number;
  classification: LeadClassification;
  painPoints: PainPoint[];
  summary: string;
  canSchedule: boolean;
  nextStage: FunnelStage;
}
