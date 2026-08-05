export const PROPOSAL_TEMPLATE_ID = "proposta-comercial-fxp";

export interface FxpProposalData {
  companyName: string;
  companyLogoUrl: string;
  segment: string;
  whatsapp: string;
  instagram: string;
  googleMapsUrl: string;
  demoUrl: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  googleBeforeAfterImageUrl: string;
  originalImplementationValue: string;
  promotionalImplementationValue: string;
  monthlyInfrastructureValue: string;
  implementationDeadline: string;
  proposalValidity: string;
  commercialNotes: string;
}

export const defaultProposalData: FxpProposalData = {
  companyName: "Empresa Cliente",
  companyLogoUrl: "",
  segment: "empresa local",
  whatsapp: "5571920017753",
  instagram: "",
  googleMapsUrl: "",
  demoUrl: "",
  desktopImageUrl: "",
  mobileImageUrl: "",
  googleBeforeAfterImageUrl: "",
  originalImplementationValue: "497",
  promotionalImplementationValue: "297",
  monthlyInfrastructureValue: "67",
  implementationDeadline: "7 dias uteis",
  proposalValidity: "7 dias",
  commercialNotes: "Proposta promocional para criacao de presenca digital profissional com infraestrutura mensal inclusa.",
};

export function encodeProposalData(data: FxpProposalData) {
  return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
}

export function decodeProposalData(value: string | null | undefined): FxpProposalData {
  if (!value) return defaultProposalData;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(value))))) as Partial<FxpProposalData>;
    return { ...defaultProposalData, ...parsed };
  } catch {
    return defaultProposalData;
  }
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}
