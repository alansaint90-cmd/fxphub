import OpenAI from "openai";
import { env } from "@/lib/env";

export interface AiMessagePlanner {
  polishResponse(input: { systemPrompt: string; userContext: string; draft: string }): Promise<string>;
}

export class OpenAiMessagePlanner implements AiMessagePlanner {
  private readonly client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

  async polishResponse(input: { systemPrompt: string; userContext: string; draft: string }): Promise<string> {
    if (!this.client) return input.draft;

    const completion = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: `${input.userContext}\n\nResposta base:\n${input.draft}` },
      ],
    });

    return completion.choices[0]?.message.content?.trim() || input.draft;
  }
}
