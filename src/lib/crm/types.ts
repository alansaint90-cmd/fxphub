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

export interface LeadFormConversationContext {
  formLeadId: string;
  name: string;
  businessName: string;
  phone: string;
  city: string | null;
  role: string | null;
  runsPaidAds: string | null;
  paidTrafficReason: string | null;
  currentDailyLeads: string | null;
  desiredDailyLeads: string | null;
  attendanceStructure: string | null;
  responseTime: string | null;
  mainChallenge: string | null;
  meetingInterest: string;
  diagnosticStatus: string | null;
  diagnosticSummary: string | null;
  qualificationScore: number;
  diagnosticAnswers: Record<string, unknown>;
}

export interface CrmRepository {
  upsertLead(input: { whatsappJid: string; phone: string; pushName?: string }): Promise<LeadRecord>;
  getLatestLeadFormContextByPhone(phone: string): Promise<LeadFormConversationContext | null>;
  applyLeadFormContextToLead(input: { leadId: string; context: LeadFormConversationContext }): Promise<LeadRecord>;
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
  setFunnelStage(input: { leadId: string; funnelStage: FunnelStage }): Promise<void>;
  setQualificationProgress(input: {
    leadId: string;
    currentQualificationQuestion: QualificationQuestionId | null;
    qualificationStarted: boolean;
  }): Promise<void>;
  markMeetingScheduled(input: { leadId: string; startsAt: Date; endsAt: Date; externalEventId?: string }): Promise<void>;
}
