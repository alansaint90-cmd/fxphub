import { describe, expect, it } from "vitest";
import { matchesSlot } from "../src/lib/crm/scheduling";

const thirteenSlot = {
  startsAt: new Date("2026-07-03T13:00:00-03:00"),
  label: "sex, 03/07 as 13h",
};

const sixteenSlot = {
  startsAt: new Date("2026-07-03T16:00:00-03:00"),
  label: "sex, 03/07 as 16h",
};

describe("matchesSlot", () => {
  it("reconhece respostas naturais de horario", () => {
    expect(matchesSlot("PODE SER AS 13", thirteenSlot)).toBe(true);
    expect(matchesSlot("13 HORas", thirteenSlot)).toBe(true);
    expect(matchesSlot("16 horas", sixteenSlot)).toBe(true);
  });

  it("nao confirma horario diferente do slot", () => {
    expect(matchesSlot("16 horas", thirteenSlot)).toBe(false);
  });
});
