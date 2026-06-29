import Redis from "ioredis";
import { env } from "@/lib/env";

interface BufferedMessage {
  id: string;
  text: string;
  createdAt: number;
}

export class ConversationBuffer {
  private readonly redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

  async appendAndCollect(
    key: string,
    message: string,
    messageId = crypto.randomUUID(),
  ): Promise<{ shouldProcess: boolean; text: string }> {
    if (!this.redis || env.MESSAGE_BUFFER_QUIET_MS === 0) {
      return { shouldProcess: true, text: message };
    }

    const redisKey = `conversation-buffer:${key}`;
    const bufferedMessage: BufferedMessage = {
      id: messageId,
      text: message,
      createdAt: Date.now(),
    };

    await this.redis.rpush(redisKey, JSON.stringify(bufferedMessage));
    await this.redis.expire(redisKey, env.MESSAGE_BUFFER_TTL_SECONDS);
    await sleep(env.MESSAGE_BUFFER_QUIET_MS);

    const rawMessages = await this.redis.lrange(redisKey, 0, -1);
    const messages = rawMessages.map(parseBufferedMessage).filter((item): item is BufferedMessage => Boolean(item));
    const latestMessage = messages.at(-1);

    if (latestMessage?.id !== messageId) {
      return { shouldProcess: false, text: "" };
    }

    await this.redis.del(redisKey);
    return {
      shouldProcess: true,
      text: messages.map((item) => item.text).join("\n"),
    };
  }

  async clear(key: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(`conversation-buffer:${key}`);
  }

  async ping(): Promise<"disabled" | "ok"> {
    if (!this.redis) return "disabled";
    await this.redis.ping();
    return "ok";
  }
}

function parseBufferedMessage(rawMessage: string): BufferedMessage | null {
  try {
    const parsed = JSON.parse(rawMessage) as BufferedMessage;
    if (!parsed.id || !parsed.text || !parsed.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
