import type {
  FunnelStage,
  LeadClassification,
  PainPoint,
  QualificationAnswerSet,
  QualificationQuestionId,
} from "@/lib/qualification/types";

export interface LeadRecord extends QualificationAnswerSet {
  id: string;
  whatsappJid: string;
  phone: string;
  pushName: string | null;
  score: number;
  classification: LeadClassification | null;
  painPoints: PainPoint[];
  qualificationSummary: string | null;
  funnelStage: FunnelStage;
  currentQualificationQuestion: QualificationQuestionId | null;
  qualificationStarted: boolean;
  aiPaused: boolean;
}

export interface CrmRepository {
  upsertLead(input: { whatsappJid: string; phone: string; pushName?: string }): Promise<LeadRecord>;
  saveInboundMessage(input: { leadId: string; body: string; messageType: string; providerMessageId?: string }): Promise<void>;
  saveOutboundMessage(input: { leadId: string; body: string }): Promise<void>;
  saveQualificationAnswer(input: {
    leadId: string;
    questionId: QualificationQuestionId;
    rawAnswer: string;
    parsedValue: string | number | boolean;
  }): Promise<void>;
  updateLeadQualification(input: {
    leadId: string;
    answers: QualificationAnswerSet;
    score: number;
    classification: LeadClassification;
    painPoints: PainPoint[];
    summary: string;
    funnelStage: FunnelStage;
    currentQualificationQuestion?: QualificationQuestionId | null;
  }): Promise<LeadRecord>;
  setQualificationProgress(input: {
    leadId: string;
    currentQualificationQuestion: QualificationQuestionId | null;
    qualificationStarted: boolean;
  }): Promise<void>;
  markMeetingScheduled(input: { leadId: string; startsAt: Date; endsAt: Date; externalEventId?: string }): Promise<void>;
}
