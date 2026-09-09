export const AI_REQUEST_LIMITS = {
  requestId: 128,
  conversationId: 128,
  messageId: 128,
  message: 12_000,
  maxAttachments: 3,
  maxBodyBytes: 256 * 1024,
} as const;

export type ChatAction = "send" | "regenerate" | "edit";

export type ValidatedChatBody = {
  operation: "CHAT" | "AUDIO" | "DOCUMENT" | "QUIZ" | "LESSON_PLAN" | null;
  action: ChatAction;
  conversationId: string | null;
  message: string;
  userMessageId: string | null;
  assistantMessageId: string | null;
  requestId: string;
  attachments: string[];
};

const SUPPORTED_ACTIONS: readonly ChatAction[] = ["send", "regenerate", "edit"];

const ALLOWED_BODY_KEYS = new Set([
  "action",
  "conversationId",
  "message",
  "userMessageId",
  "assistantMessageId",
  "requestId",
  "attachments",
  "projectId",
  "operation",
]);

export class ChatRequestValidationError extends Error {
  constructor(
    message: string,
    public readonly code = "INVALID_REQUEST",
  ) {
    super(message);
    this.name = "ChatRequestValidationError";
  }
}

function normalizeString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new ChatRequestValidationError(`${field} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new ChatRequestValidationError(`${field} is too long.`);
  }

  return normalized;
}

function optionalId(value: unknown, field: string) {
  if (value == null) {
    return null;
  }

  return (
    normalizeString(value, field, AI_REQUEST_LIMITS.conversationId) || null
  );
}

function parseAttachments(value: unknown) {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ChatRequestValidationError("attachments must be an array.");
  }

  if (value.length > AI_REQUEST_LIMITS.maxAttachments) {
    throw new ChatRequestValidationError(
      `You can attach up to ${AI_REQUEST_LIMITS.maxAttachments} files per message.`,
    );
  }

  return value.map((item, index) =>
    normalizeString(item, `attachments[${index}]`, AI_REQUEST_LIMITS.messageId),
  );
}

export async function readAndValidateChatBody(
  request: Request,
): Promise<ValidatedChatBody> {
  const contentLength = request.headers.get("content-length");

  if (contentLength && Number(contentLength) > AI_REQUEST_LIMITS.maxBodyBytes) {
    throw new ChatRequestValidationError(
      "Request body is too large.",
      "BODY_TOO_LARGE",
    );
  }

  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw new ChatRequestValidationError("Invalid JSON.", "INVALID_JSON");
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ChatRequestValidationError("Request body must be an object.");
  }

  const body = raw as Record<string, unknown>;

  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      throw new ChatRequestValidationError(
        `Unsupported request field: ${key}.`,
      );
    }
  }

  const operationValue =
    body.operation == null
      ? null
      : normalizeString(body.operation, "operation", 32);
  const supportedOperations = new Set([
    "CHAT",
    "AUDIO",
    "DOCUMENT",
    "QUIZ",
    "LESSON_PLAN",
  ]);
  if (operationValue !== null && !supportedOperations.has(operationValue)) {
    throw new ChatRequestValidationError(
      `Unsupported AI operation: ${operationValue}.`,
      "INVALID_OPERATION",
    );
  }

  const operation = operationValue as ValidatedChatBody["operation"];

  const action = normalizeString(body.action, "action", 32) as ChatAction;

  if (!SUPPORTED_ACTIONS.includes(action)) {
    throw new ChatRequestValidationError(
      `Unsupported chat action: ${action}.`,
      "INVALID_ACTION",
    );
  }

  const conversationId = optionalId(body.conversationId, "conversationId");
  const userMessageId = optionalId(body.userMessageId, "userMessageId");
  const assistantMessageId = optionalId(
    body.assistantMessageId,
    "assistantMessageId",
  );

  const message =
    body.message == null
      ? ""
      : normalizeString(body.message, "message", AI_REQUEST_LIMITS.message);

  const requestId = normalizeString(
    body.requestId,
    "requestId",
    AI_REQUEST_LIMITS.requestId,
  );

  const attachments = parseAttachments(body.attachments);

  if (!requestId) {
    throw new ChatRequestValidationError(
      "requestId is required.",
      "REQUEST_ID_REQUIRED",
    );
  }

  if (action === "send") {
    // conversationId is optional for the first message and supplied for
    // subsequent messages in the same conversation. Message IDs are not.
    if (userMessageId || assistantMessageId) {
      throw new ChatRequestValidationError(
        "send cannot include userMessageId or assistantMessageId.",
      );
    }
  }

  if (action === "regenerate") {
    if (!conversationId || !assistantMessageId) {
      throw new ChatRequestValidationError(
        "conversationId and assistantMessageId are required for regenerate.",
      );
    }

    if (userMessageId) {
      throw new ChatRequestValidationError(
        "regenerate cannot include userMessageId.",
      );
    }
  }

  if (action === "edit") {
    if (!conversationId || !userMessageId) {
      throw new ChatRequestValidationError(
        "conversationId and userMessageId are required for edit.",
      );
    }

    if (assistantMessageId) {
      throw new ChatRequestValidationError(
        "edit cannot include assistantMessageId.",
      );
    }
  }

  return {
    operation,
    action,
    conversationId,
    message,
    userMessageId,
    assistantMessageId,
    requestId,
    attachments,
  };
}
