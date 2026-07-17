import { describe, expect, it } from "vitest";
import { scoreLeadCapture } from "../src/lib/lead-capture/scoring";

const baseLead = {
  name: "Allan Nascimento",
  businessName: "Autoescola Modelo",
  phone: "5571999999999",
  role: "Dono(a)",
  paidTraffic: "Sim, utilizamos atualmente.",
  paidTrafficReason: "Quero aumentar a conversao em matriculas.",
  currentDailyLeads: "1 a 5.",
  desiredDailyLeads: "20 a 30.",
  attendanceStructure: "Uma pessoa responsavel.",
  responseTime: "Mais de 30 minutos.",
  mainChallenge: "Demora no atendimento.",
  strategyOpenness: "Sim, estou buscando exatamente isso.",
  meetingInterest: "Sim, quero receber minha analise gratuita.",
};

describe("scoreLeadCapture", () => {
  it("classifica lead HOT com decisor e interesse claro", () => {
    const result = scoreLeadCapture(baseLead);
    expect(result.status).toBe("qualified");
    expect(result.diagnosticStatus).toBe("HOT");
    expect(result.score).toBeGreaterThanOrEqual(12);
  });

  it("mantem WARM como qualificado quando ha abertura moderada", () => {
    const result = scoreLeadCapture({
      ...baseLead,
      role: "Responsavel pelo marketing ou comercial",
      currentDailyLeads: "Mais de 20.",
      responseTime: "Imediatamente.",
      strategyOpenness: "Talvez, quero entender primeiro.",
      meetingInterest: "Tenho interesse, mas preciso combinar outro momento.",
    });
    expect(result.status).toBe("qualified");
    expect(result.diagnosticStatus).toBe("WARM");
  });

  it("desqualifica quando nao ha poder de decisao", () => {
    const result = scoreLeadCapture({ ...baseLead, role: "Funcionario(a)" });
    expect(result.status).toBe("unqualified");
    expect(result.reason).toContain("decisao");
  });

  it("desqualifica quando nao ha interesse em conversar", () => {
    const result = scoreLeadCapture({ ...baseLead, meetingInterest: "Nao tenho interesse em conversar." });
    expect(result.status).toBe("unqualified");
    expect(result.reason).toContain("interesse");
  });

  it("gera resumo comercial estruturado", () => {
    const result = scoreLeadCapture(baseLead);
    expect(result.summary).toContain("Autoescola Modelo");
    expect(result.summary).toContain("1 a 5");
  });
});
