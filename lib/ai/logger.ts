import type { AIOperation } from "@/lib/ai/operations";

export type AILogLevel = "debug" | "info" | "warn" | "error";

export type AILogEvent =
  | "generation.started"
  | "generation.completed"
  | "generation.failed"
  | "generation.cancelled"
  | "provider.started"
  | "provider.completed"
  | "provider.failed"
  | "generation.persistence_failed"
  | "credits.refund_failed"
  | "credits.reconciliation_refund_failed"
  | "generation.reconciled"
  | "generation.reconciliation_skipped";

export type AILogContext = {
  requestId?: string;
  generationId?: string;
  userId?: string;
  operation?: AIOperation | string;
  provider?: string;
  model?: string;
  durationMs?: number;
  errorCode?: string;
  status?: string;
  creditsUsed?: number;
  outputLength?: number;
  requestPhase?: string;
  refundPending?: boolean;
  reconciled?: boolean;
  timeToFirstTokenMs?: number;
  previousStatus?: string;
  staleAfterMs?: number;
  inspected?: number;
  reconciliationLimit?: number;
  metadata?: Record<string, unknown>;
};

type AILogPayload = {
  timestamp: string;
  level: AILogLevel;
  event: AILogEvent;
  service: "justdy-ai";
  environment: string;
  context: AILogContext;
};

function getEnvironment(): string {
  return process.env.NODE_ENV || "development";
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;

    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey.includes("prompt") ||
      normalizedKey.includes("message") ||
      normalizedKey.includes("content") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("api_key") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("password")
    ) {
      continue;
    }

    if (typeof value === "string" && value.length > 500) {
      result[key] = `${value.slice(0, 500)}…`;
      continue;
    }

    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function buildPayload(
  level: AILogLevel,
  event: AILogEvent,
  context: AILogContext,
): AILogPayload {
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "justdy-ai",
    environment: getEnvironment(),
    context: {
      ...context,
      metadata: sanitizeMetadata(context.metadata),
    },
  };
}

function writeLog(
  level: AILogLevel,
  event: AILogEvent,
  context: AILogContext,
): void {
  const serialized = JSON.stringify(buildPayload(level, event, context));

  switch (level) {
    case "debug":
      console.debug(serialized);
      break;
    case "info":
      console.info(serialized);
      break;
    case "warn":
      console.warn(serialized);
      break;
    case "error":
      console.error(serialized);
      break;
  }
}

export function logAIDebug(
  event: AILogEvent,
  context: AILogContext = {},
): void {
  if (getEnvironment() === "production") return;
  writeLog("debug", event, context);
}

export function logAIInfo(event: AILogEvent, context: AILogContext = {}): void {
  writeLog("info", event, context);
}

export function logAIWarn(event: AILogEvent, context: AILogContext = {}): void {
  writeLog("warn", event, context);
}

export function logAIError(
  event: AILogEvent,
  context: AILogContext = {},
): void {
  writeLog("error", event, context);
}
