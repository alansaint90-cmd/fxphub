import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPublicIntegrationSettings,
  integrationSettingKeys,
  isIntegrationSettingKey,
  saveIntegrationSettings,
} from "@/lib/integrations/settings";

const integrationConfigSchema = z.object({
  values: z.record(z.string()).transform((values, context) => {
    const acceptedValues: Partial<Record<(typeof integrationSettingKeys)[number], string>> = {};

    for (const [key, value] of Object.entries(values)) {
      if (!isIntegrationSettingKey(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Chave de integracao nao permitida: ${key}`,
        });
        continue;
      }

      acceptedValues[key] = value;
    }

    return acceptedValues;
  }),
});

export async function GET() {
  try {
    const settings = await getPublicIntegrationSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar integracoes.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = integrationConfigSchema.parse(json);
    const settings = await saveIntegrationSettings(input.values);

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_integration_config", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao salvar integracoes.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
