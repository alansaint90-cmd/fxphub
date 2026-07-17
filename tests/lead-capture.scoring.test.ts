import { describe, expect, it } from "vitest";
import { scoreLeadCapture } from "../src/lib/lead-capture/scoring";

const baseLead = {
  name: "Allan Nascimento",
  businessName: "Autoescola Modelo",
  phone: "5571999999999",
  monthlyEnrollments: 45,
  salesAttendants: 2,
  usesCrm: "Nao utiliza CRM",
  runsPaidAds: "Ja investe em anuncios",
  mainChallenge: "Demora no atendimento e leads perdidos",
  meetingInterest: "Sim, quero participar de uma reuniao",
};

describe("scoreLeadCapture", () => {
  it("classifica lead qualificado com perfil ideal", () => {
    const result = scoreLeadCapture(baseLead);
    expect(result.status).toBe("qualified");
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("reprova quando nao ha interesse real em reuniao", () => {
    const result = scoreLeadCapture({ ...baseLead, meetingInterest: "Nao tenho interesse em reuniao neste momento" });
    expect(result.status).toBe("unqualified");
    expect(result.reason).toContain("interesse");
  });

  it("reprova telefone invalido", () => {
    const result = scoreLeadCapture({ ...baseLead, phone: "123" });
    expect(result.status).toBe("unqualified");
    expect(result.reason).toContain("Telefone");
  });

  it("reprova score abaixo do minimo", () => {
    const result = scoreLeadCapture({
      ...baseLead,
      monthlyEnrollments: 5,
      salesAttendants: 0,
      usesCrm: "Ja utiliza CRM",
      runsPaidAds: "Nunca investiu",
      mainChallenge: "Quero conhecer",
    });
    expect(result.status).toBe("unqualified");
  });
});
