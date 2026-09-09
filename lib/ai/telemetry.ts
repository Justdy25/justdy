import crypto from "node:crypto";

import type { AILogContext, AILogEvent, AILogLevel } from "@/lib/ai/logger";

export type AITelemetryPayload = {
  timestamp: string;
  level: AILogLevel;
  event: AILogEvent;
  service: "justdy-ai";
  environment: string;
  context: AILogContext;
};

const MAX_STRING_LENGTH = 500;
const MAX_METADATA_DEPTH = 3;
const MAX_METADATA_KEYS = 50;
const MAX_ARRAY_ITEMS = 25;

const SENSITIVE_KEY_PARTS = [
  "prompt",
  "message",
  "messages",
  "content",
  "output",
  "input",
  "inputdata",
  "input_data",
  "response",
  "completion",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "token",
  "secret",
  "password",
  "credential",
  "credentials",
  "accesskey",
  "access_key",
  "privatekey",
  "private_key",
  "refresh_token",
  "refresh",
  "session",
  "jwt",
  "bearer",
];

function getEnvironment(): string {
  return process.env.NODE_ENV || "development";
}

function isProduction(): boolean {
  return getEnvironment() === "production";
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/[-\s]/g, "_");

  return SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part));
}

function hashUserId(userId: string): string {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return "";
  }

  const secret =
    process.env.AI_TELEMETRY_HASH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();

  if (secret) {
    return crypto
      .createHmac("sha256", secret)
      .update(normalizedUserId)
      .digest("hex");
  }

  return crypto.createHash("sha256").update(normalizedUserId).digest("hex");
}

function sanitizeString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }

  if (depth >= MAX_METADATA_DEPTH) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];

    for (
      let index = 0;
      index < Math.min(value.length, MAX_ARRAY_ITEMS);
      index += 1
    ) {
      const item = sanitizeValue(value[index], depth + 1);

      if (item !== undefined) {
        result.push(item);
      }
    }

    if (value.length > MAX_ARRAY_ITEMS) {
      result.push("[truncated]");
    }

    return result;
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    const result: Record<string, unknown> = {};

    let keyCount = 0;

    for (const [key, nestedValue] of Object.entries(objectValue)) {
      if (keyCount >= MAX_METADATA_KEYS) {
        result.__truncated = true;
        break;
      }

      if (isSensitiveKey(key)) {
        continue;
      }

      const sanitizedValue = sanitizeValue(nestedValue, depth + 1);

      if (sanitizedValue === undefined) {
        continue;
      }

      result[key] = sanitizedValue;

      keyCount += 1;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  return undefined;
}

export function sanitizeTelemetryMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized = sanitizeValue(metadata, 0);

  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return undefined;
  }

  const result = sanitized as Record<string, unknown>;

  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeContext(context: AILogContext): AILogContext {
  const sanitized: AILogContext = {};

  if (context.requestId?.trim()) {
    sanitized.requestId = context.requestId.trim();
  }

  if (context.generationId?.trim()) {
    sanitized.generationId = context.generationId.trim();
  }

  if (context.userId?.trim()) {
    sanitized.userId = isProduction()
      ? hashUserId(context.userId)
      : context.userId.trim();
  }

  if (context.operation?.trim()) {
    sanitized.operation = context.operation.trim();
  }

  if (context.provider?.trim()) {
    sanitized.provider = context.provider.trim();
  }

  if (context.model?.trim()) {
    sanitized.model = context.model.trim();
  }

  if (
    typeof context.durationMs === "number" &&
    Number.isFinite(context.durationMs)
  ) {
    sanitized.durationMs = Math.max(0, Math.round(context.durationMs));
  }

  if (
    typeof context.timeToFirstTokenMs === "number" &&
    Number.isFinite(context.timeToFirstTokenMs)
  ) {
    sanitized.timeToFirstTokenMs = Math.max(
      0,
      Math.round(context.timeToFirstTokenMs),
    );
  }

  if (context.errorCode?.trim()) {
    sanitized.errorCode = context.errorCode.trim();
  }

  if (context.status?.trim()) {
    sanitized.status = context.status.trim();
  }

  if (
    typeof context.creditsUsed === "number" &&
    Number.isFinite(context.creditsUsed)
  ) {
    sanitized.creditsUsed = context.creditsUsed;
  }

  if (
    typeof context.outputLength === "number" &&
    Number.isFinite(context.outputLength)
  ) {
    sanitized.outputLength = Math.max(0, Math.round(context.outputLength));
  }

  const metadata = sanitizeTelemetryMetadata(context.metadata);

  if (metadata) {
    sanitized.metadata = metadata;
  }

  return sanitized;
}

export function buildAITelemetryPayload(
  level: AILogLevel,
  event: AILogEvent,
  context: AILogContext,
): AITelemetryPayload {
  return {
    timestamp: new Date().toISOString(),

    level,

    event,

    service: "justdy-ai",

    environment: getEnvironment(),

    context: sanitizeContext(context),
  };
}

export function writeAITelemetry(
  level: AILogLevel,
  event: AILogEvent,
  context: AILogContext,
): void {
  const payload = buildAITelemetryPayload(level, event, context);

  let serialized: string;

  try {
    serialized = JSON.stringify(payload);
  } catch {
    /*
     * Telemetry itself must never
     * cause an AI request to fail.
     */
    serialized = JSON.stringify({
      timestamp: new Date().toISOString(),

      level: "error",

      event: "generation.failed",

      service: "justdy-ai",

      environment: getEnvironment(),

      context: {
        requestId: context.requestId,

        generationId: context.generationId,

        operation: context.operation,

        errorCode: "TELEMETRY_SERIALIZATION_FAILED",
      },
    });
  }

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
