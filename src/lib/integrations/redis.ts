import Redis from "ioredis";
import { getRuntimeIntegrationSettings } from "@/lib/integrations/settings";

interface BufferedMessage {
  id: string;
  text: string;
  createdAt: number;
}

export class ConversationBuffer {
  private redis: Redis | null = null;
  private redisUrl: string | undefined;

  async appendAndCollect(
    key: string,
    message: string,
    messageId = crypto.randomUUID(),
  ): Promise<{ shouldProcess: boolean; text: string }> {
    const settings = await getRuntimeIntegrationSettings();
    const quietMs = Number(settings.MESSAGE_BUFFER_QUIET_MS ?? 2500);
    const ttlSeconds = Number(settings.MESSAGE_BUFFER_TTL_SECONDS ?? 60);
    const redis = await this.getRedis(settings.REDIS_URL);

    if (!redis || quietMs === 0) {
      return { shouldProcess: true, text: message };
    }

    try {
      const redisKey = `conversation-buffer:${key}`;
      const bufferedMessage: BufferedMessage = {
        id: messageId,
        text: message,
        createdAt: Date.now(),
      };

      await redis.rpush(redisKey, JSON.stringify(bufferedMessage));
      await redis.expire(redisKey, ttlSeconds);
      await sleep(quietMs);

      const rawMessages = await redis.lrange(redisKey, 0, -1);
      const messages = rawMessages.map(parseBufferedMessage).filter((item): item is BufferedMessage => Boolean(item));
      const latestMessage = messages.at(-1);

      if (latestMessage?.id !== messageId) {
        return { shouldProcess: false, text: "" };
      }

      await redis.del(redisKey);
      return {
        shouldProcess: true,
        text: messages.map((item) => item.text).join("\n"),
      };
    } catch {
      return { shouldProcess: true, text: message };
    }
  }

  async clear(key: string): Promise<void> {
    const settings = await getRuntimeIntegrationSettings();
    const redis = await this.getRedis(settings.REDIS_URL);
    if (!redis) return;
    await redis.del(`conversation-buffer:${key}`);
  }

  async ping(): Promise<"disabled" | "ok"> {
    const settings = await getRuntimeIntegrationSettings();
    const redis = await this.getRedis(settings.REDIS_URL);
    if (!redis) return "disabled";
    await redis.ping();
    return "ok";
  }

  private async getRedis(redisUrl: string | undefined): Promise<Redis | null> {
    if (!redisUrl) return null;
    if (!this.redis || this.redisUrl !== redisUrl) {
      this.redis?.disconnect();
      this.redis = new Redis(redisUrl);
      this.redisUrl = redisUrl;
    }
    return this.redis;
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
