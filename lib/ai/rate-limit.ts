import type { Prisma } from "@/lib/generated/prisma/client";

const DEFAULT_REQUESTS_PER_MINUTE = 20;
const DEFAULT_BURST_REQUESTS = 5;
const DEFAULT_BURST_WINDOW_SECONDS = 10;
const DEFAULT_MAX_CONCURRENT_GENERATIONS = 3;

const MIN_REQUESTS_PER_MINUTE = 1;
const MAX_REQUESTS_PER_MINUTE = 10_000;

const MIN_BURST_REQUESTS = 1;
const MAX_BURST_REQUESTS = 1_000;

const MIN_BURST_WINDOW_SECONDS = 1;
const MAX_BURST_WINDOW_SECONDS = 300;

const MIN_MAX_CONCURRENT_GENERATIONS = 1;
const MAX_MAX_CONCURRENT_GENERATIONS = 100;

export class AIRateLimitError extends Error {
  readonly code = "RATE_LIMITED" as const;
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);

    this.name = "AIRateLimitError";
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value.trim());

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

export const AI_RATE_LIMITS = {
  requestsPerMinute: parsePositiveInt(
    process.env.AI_RATE_LIMIT_PER_MINUTE,
    DEFAULT_REQUESTS_PER_MINUTE,
    MIN_REQUESTS_PER_MINUTE,
    MAX_REQUESTS_PER_MINUTE,
  ),

  burstRequests: parsePositiveInt(
    process.env.AI_RATE_LIMIT_BURST,
    DEFAULT_BURST_REQUESTS,
    MIN_BURST_REQUESTS,
    MAX_BURST_REQUESTS,
  ),

  burstWindowSeconds: parsePositiveInt(
    process.env.AI_RATE_LIMIT_BURST_WINDOW_SECONDS,
    DEFAULT_BURST_WINDOW_SECONDS,
    MIN_BURST_WINDOW_SECONDS,
    MAX_BURST_WINDOW_SECONDS,
  ),

  maxConcurrentGenerations: parsePositiveInt(
    process.env.AI_MAX_CONCURRENT_GENERATIONS,
    DEFAULT_MAX_CONCURRENT_GENERATIONS,
    MIN_MAX_CONCURRENT_GENERATIONS,
    MAX_MAX_CONCURRENT_GENERATIONS,
  ),
} as const;

type TransactionClient = Prisma.TransactionClient;

function rateLimitKey(userId: string, windowSeconds: number): string {
  return `ai-rate:${windowSeconds}:${userId}`;
}

function lockKey(userId: string): string {
  return `ai-abuse:${userId}`;
}

/**
 * Serialize rate-limit and concurrency checks for the same user.
 *
 * PostgreSQL transaction-level advisory locks are held until the
 * surrounding transaction commits or rolls back.
 */
async function lockUserAIAbuseControls(
  tx: TransactionClient,
  userId: string,
): Promise<void> {
  if (!userId.trim()) {
    throw new Error("AI rate-limit user ID is required.");
  }

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${lockKey(userId)}, 0)
    )
  `;
}

function getWindowStart(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;

  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function getRetryAfterSeconds(
  now: Date,
  windowStart: Date,
  windowSeconds: number,
): number {
  const windowEnd = windowStart.getTime() + windowSeconds * 1000;

  return Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000));
}

/**
 * Consume one request from a fixed-window bucket.
 *
 * The caller must already hold the user advisory lock.
 */
async function consumeBucket({
  tx,
  userId,
  now,
  windowSeconds,
  limit,
}: {
  tx: TransactionClient;
  userId: string;
  now: Date;
  windowSeconds: number;
  limit: number;
}): Promise<void> {
  const windowStart = getWindowStart(now, windowSeconds);

  const key = rateLimitKey(userId, windowSeconds);

  const bucket = await tx.aIRateLimitBucket.findUnique({
    where: {
      key,
    },
    select: {
      id: true,
      windowStart: true,
      requestCount: true,
    },
  });

  /**
   * No bucket yet, or the previous bucket belongs
   * to an expired time window.
   */
  if (!bucket || bucket.windowStart.getTime() !== windowStart.getTime()) {
    if (bucket) {
      await tx.aIRateLimitBucket.update({
        where: {
          id: bucket.id,
        },
        data: {
          windowStart,
          requestCount: 1,
        },
      });
    } else {
      await tx.aIRateLimitBucket.create({
        data: {
          key,
          windowStart,
          requestCount: 1,
        },
      });
    }

    return;
  }

  /**
   * Bucket is currently at its limit.
   */
  if (bucket.requestCount >= limit) {
    throw new AIRateLimitError(
      "Too many AI requests. Please wait before trying again.",
      getRetryAfterSeconds(now, windowStart, windowSeconds),
    );
  }

  await tx.aIRateLimitBucket.update({
    where: {
      id: bucket.id,
    },
    data: {
      requestCount: {
        increment: 1,
      },
    },
  });
}

/**
 * Enforce per-user AI request limits.
 *
 * Two fixed-window buckets are enforced:
 *
 * 1. Short burst protection.
 * 2. Requests-per-minute protection.
 *
 * Both execute inside the caller's transaction so that
 * a rejected generation rolls back the bucket increment.
 */
export async function enforceAIRateLimit(
  tx: TransactionClient,
  userId: string,
): Promise<void> {
  await lockUserAIAbuseControls(tx, userId);

  const now = new Date();

  await consumeBucket({
    tx,
    userId,
    now,
    windowSeconds: AI_RATE_LIMITS.burstWindowSeconds,
    limit: AI_RATE_LIMITS.burstRequests,
  });

  await consumeBucket({
    tx,
    userId,
    now,
    windowSeconds: 60,
    limit: AI_RATE_LIMITS.requestsPerMinute,
  });
}

/**
 * Enforce the maximum number of currently active
 * AI generations for a user.
 *
 * PENDING and PROCESSING generations count as active.
 *
 * The same advisory lock used by enforceAIRateLimit()
 * makes this check race-safe across tabs and app
 * instances when both checks execute in the same
 * transaction.
 */
export async function enforceAIConcurrencyLimit(
  tx: TransactionClient,
  userId: string,
): Promise<void> {
  await lockUserAIAbuseControls(tx, userId);

  const activeGenerationCount = await tx.aIGeneration.count({
    where: {
      userId,
      status: {
        in: ["PENDING", "PROCESSING"],
      },
    },
  });

  if (activeGenerationCount >= AI_RATE_LIMITS.maxConcurrentGenerations) {
    throw new AIRateLimitError(
      "You already have too many AI generations running. Please wait for one to finish.",
      1,
    );
  }
}

/**
 * Remove old fixed-window buckets.
 *
 * Call this from an existing maintenance or
 * reconciliation job rather than on every chat request.
 */
export async function cleanupExpiredAIRateLimitBuckets(
  tx: TransactionClient,
  olderThanMs = 24 * 60 * 60 * 1000,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);

  const result = await tx.aIRateLimitBucket.deleteMany({
    where: {
      windowStart: {
        lt: cutoff,
      },
    },
  });

  return result.count;
}
