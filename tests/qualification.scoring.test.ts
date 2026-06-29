import { describe, expect, it } from "vitest";
import { calculateQualification } from "../src/lib/qualification/scoring";

describe("calculateQualification", () => {
  it("classifica como A quando ha volume, trafego e dor clara de CRM", () => {
    const result = calculateQualification({
      drivingSchoolName: "CFC Catuense",
      monthlyEnrollments: 45,
      commercialAttendants: 4,
      usesCrm: false,
      runsPaidTraffic: true,
      city: "Catu",
    });

    expect(result.classification).toBe("A");
    expect(result.canSchedule).toBe(true);
    expect(result.painPoints).toContain("falta_de_crm");
    expect(result.painPoints).toContain("demora_no_atendimento");
  });

  it("classifica como C quando ha pouca estrutura e baixa intencao operacional", () => {
    const result = calculateQualification({
      drivingSchoolName: "Autoescola Exemplo",
      monthlyEnrollments: 3,
      commercialAttendants: 0,
      usesCrm: true,
      runsPaidTraffic: false,
      city: "Salvador",
    });

    expect(result.classification).toBe("C");
    expect(result.canSchedule).toBe(false);
    expect(result.nextStage).toBe("nao_qualificado");
  });
});
