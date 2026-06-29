import Redis from "ioredis";
import { env } from "@/lib/env";

export class ConversationBuffer {
  private readonly redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

  async appendAndRead(key: string, message: string): Promise<string> {
    if (!this.redis) return message;

    const redisKey = `conversation-buffer:${key}`;
    await this.redis.rpush(redisKey, message);
    await this.redis.expire(redisKey, 45);
    const messages = await this.redis.lrange(redisKey, 0, -1);
    return messages.join("\n");
  }

  async clear(key: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(`conversation-buffer:${key}`);
  }
}
