import OpenAI from "openai";
import { getRuntimeIntegrationSettings } from "@/lib/integrations/settings";

export interface AiMessagePlanner {
  polishResponse(input: { systemPrompt: string; userContext: string; draft: string }): Promise<string>;
}

export class OpenAiMessagePlanner implements AiMessagePlanner {
  async transcribeAudio(input: { data: Uint8Array; filename?: string; mimeType?: string }): Promise<string | null> {
    try {
      const settings = await getRuntimeIntegrationSettings();
      if (!settings.OPENAI_API_KEY) return null;

      const client = new OpenAI({ apiKey: settings.OPENAI_API_KEY });
      const audioBuffer = input.data.buffer.slice(
        input.data.byteOffset,
        input.data.byteOffset + input.data.byteLength,
      ) as ArrayBuffer;
      const file = new File([audioBuffer], input.filename ?? "audio.ogg", {
        type: input.mimeType ?? "audio/ogg",
      });
      const transcription = await client.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "pt",
      });

      return transcription.text?.trim() || null;
    } catch {
      return null;
    }
  }

  async polishResponse(input: { systemPrompt: string; userContext: string; draft: string }): Promise<string> {
    try {
      const settings = await getRuntimeIntegrationSettings();
      if (!settings.OPENAI_API_KEY) return input.draft;

      const client = new OpenAI({ apiKey: settings.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: settings.OPENAI_MODEL ?? "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: `${input.userContext}\n\nResposta base:\n${input.draft}` },
        ],
      });

      const response = completion.choices[0]?.message.content?.trim() || input.draft;
      if (response.length > 360 || response.split("\n").length > 4) return input.draft;
      return response;
    } catch {
      return input.draft;
    }
  }
}
