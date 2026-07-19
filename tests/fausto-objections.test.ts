import { describe, expect, it } from "vitest";
import { getSchedulingObjectionResponse } from "../src/lib/crm/objections";

describe("Fausto objection handling", () => {
  it("quebra objecao de experiencia ruim com trafego e retoma agenda", () => {
    const response = getSchedulingObjectionResponse("Ja tentei trafego pago e nao funcionou");

    expect(response).toContain("Normalmente isso acontece");
    expect(response).toContain("horarios disponiveis");
  });

  it("responde objecao de valor sem inventar preco", () => {
    const response = getSchedulingObjectionResponse("Qual valor?");

    expect(response).toContain("depende do objetivo");
    expect(response).toContain("demonstracao");
  });

  it("pede a duvida exata quando a objecao e generica", () => {
    const response = getSchedulingObjectionResponse("Tenho duvida");

    expect(response).toBe("Claro. Qual e a sua duvida? Te respondo de forma objetiva para vermos se faz sentido agendar.");
  });
});
