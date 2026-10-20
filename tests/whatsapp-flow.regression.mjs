import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// Run the conversation service without infrastructure or installed dependencies.
registerHooks({
  resolve(specifier, context, nextResolve) {
    let url;
    if (specifier.startsWith("@/")) url = new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url);
    else if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) url = candidate;
    }
    return url ? { url: url.href, shortCircuit: true } : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".ts")) return nextLoad(url, context);
    return {
      format: "module", shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8"), { mode: "transform" }),
    };
  },
});

const { FaustoConversationService } = await import("../src/lib/crm/fausto-conversation-service.ts");
const { commercialAgentPrompts } = await import("../src/lib/qualification/agent-prompts.ts");
const trigger = "quero testar o agente de IA no WhatsApp para minha autoescola";

function conversation(state, started = true, paused = false) {
  const lead = { id: "test", currentQualificationQuestion: state, qualificationStarted: started,
    aiPaused: paused, funnelStage: "ia_atendendo", painPoints: [], score: 0 };
  let latest = "Só para confirmar: os materiais recebidos são o print do Instagram. É isso mesmo?";
  const outbound = [];
  const crm = {
    upsertLead: async () => lead,
    saveInboundMessage: async () => {},
    getLatestOutboundMessage: async () => latest,
    saveOutboundMessage: async ({ body }) => { latest = body; outbound.push(body); },
    setFunnelStage: async ({ funnelStage }) => { lead.funnelStage = funnelStage; },
    setQualificationProgress: async (progress) => Object.assign(lead, progress),
    saveQualificationAnswer: async () => {},
    updateLeadQualification: async (progress) => Object.assign(lead, progress.answers, progress),
  };
  const ai = { polishResponse: async ({ draft }) => draft };
  const service = new FaustoConversationService(crm, ai, {});
  return { lead, outbound, send: (text) => service.handleInbound({ whatsappJid: "test", phone: "test", text, messageType: "conversation" }) };
}

for (const state of ["tiagoMaterials", "tiagoNeedsInstagram", "tiagoNeedsGoogle", "tiagoAwaitingConfirmation", "tiagoProduction"]) {
  test(`SDR trigger overrides retired state ${state} and continues SDR`, async () => {
    const flow = conversation(state);
    const result = await flow.send(trigger);
    assert.equal(result.shouldSend, true);
    assert.match(result.response, /Dereck Nascimento/);
    assert.equal(flow.lead.currentQualificationQuestion, "responsibleName");
    const next = await flow.send("Maria");
    assert.equal(next.shouldSend, true);
    assert.match(next.response, /nome da sua autoescola/);
    assert.doesNotMatch(flow.outbound.join("\n"), /Tiago|Instagram|materiais|criação do site/i);
  });
  test(`retired state ${state} stays silent without SDR trigger`, async () => {
    assert.equal((await conversation(state).send("sim")).shouldSend, false);
  });
}

test("site campaign and old SDR trigger cannot activate a new conversation", async () => {
  for (const text of ["Vim pela campanha do Tiago César e quero um site", "quero testar o agente de IA no WhatsApp", "Olá"]) {
    assert.equal((await conversation(null, false).send(text)).shouldSend, false);
  }
});
test("manual AI pause is preserved", async () => {
  assert.equal((await conversation("tiagoMaterials", true, true).send(trigger)).shouldSend, false);
});
test("retired campaign is absent from available agents", () => {
  assert.equal(commercialAgentPrompts.some(({ id }) => id === "tiago_sites"), false);
});
