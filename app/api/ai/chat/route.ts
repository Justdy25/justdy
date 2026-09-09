import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { detectAIIntent } from "@/lib/ai/orchestration/intent";
import { parseVideoCommand } from "@/lib/ai/orchestration/video-command";
import { generateWorksheetFromChat } from "@/lib/ai/orchestration/worksheet-handler";
import { generateVideo } from "@/lib/ai/video/generator";
import { generateImageFromChat } from "@/lib/ai/orchestration/image-handler";
import {
  AIRateLimitError,
  enforceAIRateLimit,
  enforceAIConcurrencyLimit,
} from "@/lib/ai/rate-limit";
import {
  ChatRequestValidationError,
  readAndValidateChatBody,
  type ChatAction,
} from "@/lib/ai/request-validation";
import {
  reconcileStaleAIGenerations,
  streamAI,
} from "@/lib/ai/generation/generate";
import type { AIChatMessage } from "@/lib/ai/types";
import { getCreditBalance, InsufficientAICreditsError } from "@/lib/ai/credits";
import { AIError, isAIError } from "@/lib/ai/errors";
import {
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

const MAX_MESSAGES = 20;

// Keep the AI context bounded without loading the entire conversation.
// The visible conversation remains complete; only generation context is bounded.
const CONTEXT_MESSAGE_LIMIT = MAX_MESSAGES;
const MAX_CONTEXT_CHARACTERS = 60_000;

const SERIALIZABLE_TRANSACTION_RETRIES = 3;

/**
 * Optional test-only pause used to exercise worksheet stale-conversation races.
 * Disabled by default; production behavior is unchanged unless explicitly set.
 */
const WORKSHEET_TEST_DELAY_MS = Math.max(
  0,
  Number(process.env.JUSTDY_TEST_WORKSHEET_DELAY_MS ?? 0) || 0,
);

async function delayForWorksheetRaceTest(): Promise<void> {
  if (WORKSHEET_TEST_DELAY_MS <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, WORKSHEET_TEST_DELAY_MS);
  });
}

function isSerializationConflict(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as Error & {
    code?: unknown;
    originalCode?: unknown;
    cause?: {
      code?: unknown;
      originalCode?: unknown;
      message?: unknown;
    };
  };

  if (
    candidate.code === "40001" ||
    candidate.originalCode === "40001" ||
    candidate.cause?.code === "40001" ||
    candidate.cause?.originalCode === "40001"
  ) {
    return true;
  }

  return (
    candidate.message.includes("could not serialize access") ||
    candidate.cause?.message === "could not serialize access"
  );
}

async function runSerializableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= SERIALIZABLE_TRANSACTION_RETRIES;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error)) {
        throw error;
      }

      if (attempt === SERIALIZABLE_TRANSACTION_RETRIES) {
        throw error;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 25 * 2 ** (attempt - 1));
      });
    }
  }

  throw new Error("Serializable transaction failed unexpectedly.");
}

function serializeAIError(error: AIError): Record<string, unknown> {
  return {
    error: error.message,
    code: error.code,
    ...(error.details?.requestId ? { requestId: error.details.requestId } : {}),
  };
}

type ChatMessageRecord = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: Date;
  userId: string;
  generationId: string | null;
  videoGenerationId?: string | null;
  parentMessageId: string | null;
  metadata?: Prisma.JsonValue | null;
  attachments?: Prisma.JsonValue | null;
};

type StoredChatAttachment = {
  assetId: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "file";
  openAIFileId: string;
};

function normalizeStoredAttachmentKind(value: unknown): "image" | "file" {
  return value === "image" ? "image" : "file";
}

function readAttachmentMetadata(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const metadata = value as Record<string, unknown>;
  const openAIFileId = metadata.openAIFileId;
  const kind = metadata.kind;

  if (
    typeof openAIFileId !== "string" ||
    (kind !== "image" && kind !== "file")
  ) {
    return null;
  }

  return { openAIFileId, kind };
}

async function resolveChatAttachments(
  userId: string,
  assetIds: string[],
): Promise<StoredChatAttachment[]> {
  if (assetIds.length === 0) return [];

  const assets = await prisma.aIAsset.findMany({
    where: {
      id: { in: assetIds },
      userId,
    },
    select: {
      id: true,
      name: true,
      mimeType: true,
      fileSize: true,
      metadata: true,
    },
  });

  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  return assetIds.map((assetId) => {
    const asset = byId.get(assetId);
    const metadata = readAttachmentMetadata(asset?.metadata);

    if (!asset || !metadata) {
      throw new Error("One or more uploaded files are no longer available.");
    }

    return {
      assetId: asset.id,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.fileSize ?? 0,
      kind: normalizeStoredAttachmentKind(metadata.kind),
      openAIFileId: metadata.openAIFileId,
    };
  });
}

async function claimWorksheetGeneration({
  userId,
  requestId,
  prompt,
  projectId,
}: {
  userId: string;
  requestId: string;
  prompt: string;
  projectId: string | null;
}) {
  try {
    const generation = await prisma.aIGeneration.create({
      data: {
        userId,
        requestId,
        projectId,
        type: AIGenerationType.WORKSHEET,
        operation: "WORKSHEET",
        status: AIGenerationStatus.PENDING,
        prompt,
        inputData: {
          source: "AI_CHAT",
        },
        provider: "openai",
        model: "gpt-5",
        startedAt: new Date(),
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
      },
    });

    return {
      claimed: true as const,
      generation,
    };
  } catch (error) {
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
    ) {
      throw error;
    }

    const existing = await prisma.aIGeneration.findUnique({
      where: {
        requestId,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
      },
    });

    if (
      !existing ||
      existing.userId !== userId ||
      existing.type !== AIGenerationType.WORKSHEET
    ) {
      throw new Error("The request ID is already in use.");
    }

    return {
      claimed: false as const,
      generation: existing,
    };
  }
}

function buildAIMessageContent(
  prompt: string,
  attachments: StoredChatAttachment[],
): AIChatMessage["content"] {
  if (attachments.length === 0) return prompt;

  return [
    {
      type: "input_text",
      text: prompt || "Please analyze the attached file(s).",
    },
    ...attachments.map((attachment) =>
      attachment.kind === "image"
        ? {
            type: "input_image" as const,
            file_id: attachment.openAIFileId,
            detail: "auto" as const,
          }
        : {
            type: "input_file" as const,
            file_id: attachment.openAIFileId,
            filename: attachment.name,
          },
    ),
  ];
}

function clientAttachments(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const attachment = item as Record<string, unknown>;

    if (
      typeof attachment.assetId !== "string" ||
      typeof attachment.name !== "string" ||
      typeof attachment.mimeType !== "string" ||
      typeof attachment.size !== "number" ||
      (attachment.kind !== "image" && attachment.kind !== "file")
    ) {
      return [];
    }

    return [
      {
        assetId: attachment.assetId,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        kind: attachment.kind,
      },
    ];
  });
}

function serializeChatMessage(message: ChatMessageRecord) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    userId: message.userId,
    generationId: message.generationId,
    videoGenerationId: message.videoGenerationId ?? null,
    parentMessageId: message.parentMessageId,
    metadata: message.metadata ?? null,
    attachments: clientAttachments(message.attachments),
  };
}

async function sanitizeConversationVideoGenerationIds(
  messages: ChatMessageRecord[],
  userId: string,
): Promise<ChatMessageRecord[]> {
  const videoGenerationIds = [
    ...new Set(
      messages
        .map((message) => message.videoGenerationId)
        .filter((videoGenerationId): videoGenerationId is string =>
          Boolean(videoGenerationId),
        ),
    ),
  ];

  if (videoGenerationIds.length === 0) {
    return messages;
  }

  const validVideoGenerations = await prisma.videoGeneration.findMany({
    where: {
      id: { in: videoGenerationIds },
      userId,
    },
    select: { id: true },
  });

  const validVideoGenerationIds = new Set(
    validVideoGenerations.map((generation) => generation.id),
  );

  return messages.map((message) => {
    if (
      !message.videoGenerationId ||
      validVideoGenerationIds.has(message.videoGenerationId)
    ) {
      return message;
    }

    return { ...message, videoGenerationId: null };
  });
}

async function sanitizeConversationGenerationIds(
  messages: ChatMessageRecord[],
  userId: string,
  projectId: string | null,
): Promise<ChatMessageRecord[]> {
  const generationIds = [
    ...new Set(
      messages
        .map((message) => message.generationId)
        .filter((generationId): generationId is string =>
          Boolean(generationId),
        ),
    ),
  ];

  if (generationIds.length === 0) {
    return messages;
  }

  const validGenerations = await prisma.aIGeneration.findMany({
    where: {
      id: { in: generationIds },
      userId,
      projectId,
    },
    select: { id: true },
  });

  const validGenerationIds = new Set(
    validGenerations.map((generation) => generation.id),
  );

  return messages.map((message) => {
    if (!message.generationId || validGenerationIds.has(message.generationId)) {
      return message;
    }

    return { ...message, generationId: null };
  });
}

const CHAT_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_JSON: "INVALID_JSON",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND",
  MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND",
  INVALID_ACTION: "INVALID_ACTION",
  INVALID_CURSOR: "INVALID_CURSOR",
  REQUEST_ID_REQUIRED: "REQUEST_ID_REQUIRED",
  DUPLICATE_GENERATION_REQUEST: "DUPLICATE_GENERATION_REQUEST",
  REQUEST_ID_CONFLICT: "REQUEST_ID_CONFLICT",
  CONVERSATION_CHANGED: "CONVERSATION_CHANGED",
  RATE_LIMITED: "RATE_LIMITED",
  INSUFFICIENT_AI_CREDITS: "INSUFFICIENT_AI_CREDITS",
  GENERATION_CANCELLED: "GENERATION_CANCELLED",
  GENERATION_FAILED: "GENERATION_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

function errorResponse(
  message: string,
  status: number,
  code: string = CHAT_ERROR_CODES.INVALID_REQUEST,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(extra ?? {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function getAIErrorStatus(error: AIError): number {
  switch (error.code) {
    case "INVALID_REQUEST":
    case "UNSUPPORTED_OPERATION":
    case "UNSUPPORTED_STREAMING":
    case "PROVIDER_NOT_SUPPORTED":
    case "MODEL_NOT_SUPPORTED":
    case "MODEL_NOT_PERMITTED":
      return 400;

    case "PROVIDER_NOT_CONFIGURED":
      return 503;

    case "GENERATION_CANCELLED":
      return 499;

    case "EMPTY_RESPONSE":
    case "PROVIDER_ERROR":
      return 502;

    case "GENERATION_ERROR":
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}

function aiErrorResponse(error: AIError) {
  const requestId = error.details?.requestId;

  return errorResponse(
    error.message,
    getAIErrorStatus(error),
    error.code,
    requestId ? { requestId } : undefined,
  );
}

function normalizeOptionalId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();

  return normalized || null;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return new Response(
        JSON.stringify({
          error: "Authentication required",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { searchParams } = new URL(request.url);

    const conversationId = normalizeOptionalId(
      searchParams.get("conversationId"),
    );

    const projectId = normalizeOptionalId(searchParams.get("projectId"));

    if (projectId) {
      const project = await prisma.aIProject.findFirst({
        where: { id: projectId, userId: user.id, status: "ACTIVE" },
        select: { id: true },
      });

      if (!project) {
        return errorResponse(
          "Project not found or is no longer active.",
          404,
          CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND,
        );
      }
    }

    if (conversationId) {
      const rawLimit = Number(searchParams.get("limit") ?? "50");

      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.floor(rawLimit), 1), 100)
        : 50;

      const beforeCreatedAt = searchParams.get("beforeCreatedAt");
      const beforeId = searchParams.get("beforeId");

      let before: { createdAt: Date; id: string } | null = null;

      if (beforeCreatedAt || beforeId) {
        if (!beforeCreatedAt || !beforeId) {
          return errorResponse(
            "Both beforeCreatedAt and beforeId are required.",
            400,
            CHAT_ERROR_CODES.INVALID_CURSOR,
          );
        }

        const parsedDate = new Date(beforeCreatedAt);

        if (!Number.isFinite(parsedDate.getTime()) || !beforeId.trim()) {
          return errorResponse(
            "Invalid pagination cursor.",
            400,
            CHAT_ERROR_CODES.INVALID_CURSOR,
          );
        }

        before = {
          createdAt: parsedDate,
          id: beforeId.trim(),
        };
      }

      const conversation = await prisma.aIConversation.findFirst({
        where: {
          id: conversationId,
          userId: user.id,
          status: "ACTIVE",
          ...(projectId ? { projectId } : {}),
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          model: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              messages: true,
            },
          },
          activeMessageId: true,
        },
      });

      if (!conversation) {
        return errorResponse(
          "Conversation not found.",
          404,
          CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND,
        );
      }

      // Messages are a single linear conversation. activeMessageId is only
      // the current tail pointer for the linear conversation.
      const page = before
        ? await loadMessagesBefore(
            prisma,
            conversation.id,
            user.id,
            before,
            limit + 1,
          )
        : await loadRecentMessages(prisma, conversation.id, user.id, limit + 1);

      const hasMore = page.length > limit;
      const orderedMessages = hasMore ? page.slice(-limit) : page;
      const oldestMessage = orderedMessages[0] ?? null;
      // Always scope generation ownership checks to the authenticated user.
      // Do not rely on conversation.userId here because this GET select intentionally
      // does not need to expose that field to the response object.
      const sanitizedGenerationMessages =
        await sanitizeConversationGenerationIds(
          orderedMessages,
          user.id,
          conversation.projectId,
        );
      const sanitizedMessages = await sanitizeConversationVideoGenerationIds(
        sanitizedGenerationMessages,
        user.id,
      );

      return NextResponse.json(
        {
          conversation: {
            id: conversation.id,
            projectId: conversation.projectId,
            title: conversation.title,
            model: conversation.model,
            status: conversation.status,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            messageCount: conversation._count.messages,
          },
          messages: sanitizedMessages.map(serializeChatMessage),
          pagination: {
            limit,
            hasMore,
            nextCursor:
              hasMore && oldestMessage
                ? {
                    createdAt: oldestMessage.createdAt.toISOString(),
                    id: oldestMessage.id,
                  }
                : null,
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const [conversations, credits] = await Promise.all([
      prisma.aIConversation.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
          ...(projectId ? { projectId } : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 100,
        select: {
          id: true,
          projectId: true,
          title: true,
          model: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),

      getCreditBalance(user.id),
    ]);

    return NextResponse.json(
      {
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          projectId: conversation.projectId,
          title: conversation.title,
          model: conversation.model,
          status: conversation.status,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messageCount: conversation._count.messages,
        })),
        credits: {
          balance: credits,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/ai/chat:", error);

    return errorResponse(
      "Unable to load AI conversations.",
      500,
      CHAT_ERROR_CODES.INTERNAL_ERROR,
    );
  }
}

async function replaceEditedUserMessage(
  tx: Prisma.TransactionClient,
  conversationId: string,
  userId: string,
  userMessageId: string,
  newContent: string,
) {
  const target = await tx.aIMessage.findFirst({
    where: { id: userMessageId, conversationId, userId, role: "USER" },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      userId: true,
      generationId: true,
      videoGenerationId: true,
      parentMessageId: true,
      metadata: true,
      attachments: true,
    },
  });

  if (!target) throw new Error("User message not found.");

  const levels: string[][] = [];
  let frontier = [target.id];

  while (frontier.length > 0) {
    const children = await tx.aIMessage.findMany({
      where: { conversationId, userId, parentMessageId: { in: frontier } },
      select: { id: true },
    });
    if (children.length === 0) break;
    const ids = children.map((child) => child.id);
    levels.push(ids);
    frontier = ids;
  }

  if (levels.length > 0) {
    const descendantIds = levels.flat();
    await tx.aIConversation.updateMany({
      where: {
        id: conversationId,
        userId,
        status: "ACTIVE",
        activeMessageId: { in: descendantIds },
      },
      data: { activeMessageId: null },
    });

    for (let i = levels.length - 1; i >= 0; i -= 1) {
      await tx.aIMessage.deleteMany({
        where: { conversationId, userId, id: { in: levels[i] } },
      });
    }
  }

  return tx.aIMessage.update({
    where: { id: target.id },
    data: {
      content: newContent,
      generationId: null,
      videoGenerationId: null,
      metadata: Prisma.DbNull,
    },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      userId: true,
      generationId: true,
      videoGenerationId: true,
      parentMessageId: true,
      metadata: true,
      attachments: true,
    },
  });
}

async function resolveChatIntent({
  action,
  message,
  conversationId,
  userId,
  assistantMessageId,
}: {
  action: ChatAction;
  message: string;
  conversationId: string | null;
  userId: string;
  assistantMessageId: string | null;
}) {
  if (action === "send" || action === "edit") {
    return detectAIIntent(message);
  }

  if (!conversationId) {
    return detectAIIntent(message);
  }

  if (action === "regenerate" && assistantMessageId) {
    const assistantMessage = await prisma.aIMessage.findFirst({
      where: {
        id: assistantMessageId,
        conversationId,
        userId,
        role: "ASSISTANT",
      },
      select: {
        videoGenerationId: true,
        parentMessageId: true,
        metadata: true,
        attachments: true,
      },
    });

    // A persisted video message is authoritative.
    if (assistantMessage?.videoGenerationId) {
      return {
        intent: "VIDEO" as const,
        confidence: 1,
      };
    }

    // Specialized image messages persist their intent in metadata.
    const metadata = assistantMessage?.metadata;

    const metadataType =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as { type?: unknown }).type
        : undefined;

    if (metadataType === "IMAGE") {
      return {
        intent: "IMAGE" as const,
        confidence: 1,
      };
    }

    if (metadataType === "WORKSHEET") {
      return {
        intent: "WORKSHEET" as const,
        confidence: 1,
      };
    }

    if (assistantMessage?.parentMessageId) {
      const userMessage = await prisma.aIMessage.findFirst({
        where: {
          id: assistantMessage.parentMessageId,
          conversationId,
          userId,
          role: "USER",
        },
        select: {
          content: true,
        },
      });

      return detectAIIntent(userMessage?.content ?? message);
    }
  }

  return detectAIIntent(message);
}

export async function POST(request: Request) {
  let requestId = "";
  let authenticatedUserId: string | null = null;
  let worksheetGenerationId: string | null = null;

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    authenticatedUserId = user.id;

    if (request.signal.aborted) {
      return errorResponse(
        "Request cancelled.",
        499,
        CHAT_ERROR_CODES.GENERATION_CANCELLED,
      );
    }

    let requestedProjectId: string | null = null;

    try {
      const rawBody = await request.clone().json();
      requestedProjectId = normalizeOptionalId(rawBody?.projectId);
    } catch {
      // Let readAndValidateChatBody() produce the canonical JSON validation error.
    }

    if (requestedProjectId) {
      const project = await prisma.aIProject.findFirst({
        where: { id: requestedProjectId, userId: user.id, status: "ACTIVE" },
        select: { id: true },
      });

      if (!project) {
        return errorResponse(
          "Project not found or is no longer active.",
          404,
          CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND,
        );
      }
    }

    let body;

    try {
      body = await readAndValidateChatBody(request);
    } catch (error: unknown) {
      if (error instanceof ChatRequestValidationError) {
        return errorResponse(error.message, 400, error.code);
      }

      throw error;
    }

    const {
      action,
      conversationId,
      message,
      userMessageId,
      assistantMessageId,
      attachments: attachmentAssetIds,
    } = body;

    requestId = body.requestId;

    if (!requestId || !requestId.trim()) {
      return errorResponse(
        "Request ID is required.",
        400,
        CHAT_ERROR_CODES.INVALID_REQUEST,
      );
    }

    requestId = requestId.trim();

    if (!conversationId && action !== "send") {
      return errorResponse(
        "Conversation ID is required.",
        400,
        CHAT_ERROR_CODES.INVALID_REQUEST,
      );
    }

    if (action === "edit" && !userMessageId) {
      return errorResponse(
        "User message ID is required for editing.",
        400,
        CHAT_ERROR_CODES.INVALID_REQUEST,
      );
    }

    await reconcileStaleAIGenerations({
      userId: user.id,
      limit: 25,
    });

    const intent = await resolveChatIntent({
      action,
      message,
      conversationId,
      userId: user.id,
      assistantMessageId: assistantMessageId ?? null,
    });

    if (intent.intent === "WORKSHEET") {
      const claimedWorksheetGeneration = await claimWorksheetGeneration({
        userId: user.id,
        requestId,
        prompt: message,
        projectId: requestedProjectId,
      });

      if (!claimedWorksheetGeneration.claimed) {
        const existing = claimedWorksheetGeneration.generation;

        return errorResponse(
          existing.status === AIGenerationStatus.COMPLETED
            ? "This worksheet request has already been completed."
            : existing.status === AIGenerationStatus.FAILED
              ? "This worksheet request has already failed. Please submit a new request."
              : "This worksheet request is already being processed.",
          409,
          CHAT_ERROR_CODES.DUPLICATE_GENERATION_REQUEST,
          {
            generationId: existing.id,
            status: existing.status,
            type: "WORKSHEET",
          },
        );
      }

      const claimedGeneration = claimedWorksheetGeneration.generation;
      const generationId = claimedGeneration.id;

      worksheetGenerationId = generationId;

      const preparedWorksheet = await prepareWorksheetChatGeneration({
        userId: user.id,
        conversationId,
        projectId: requestedProjectId,
        message,
        action,
        userMessageId: userMessageId ?? null,
        assistantMessageId: assistantMessageId ?? null,
      });

      await prisma.aIGeneration.updateMany({
        where: {
          id: generationId,
          userId: user.id,
          status: AIGenerationStatus.PENDING,
        },
        data: {
          prompt: preparedWorksheet.prompt,
          inputData: {
            source: "AI_CHAT",
          },
        },
      });

      const result = await generateWorksheetFromChat({
        userId: user.id,
        prompt: preparedWorksheet.prompt,
      });

      // Test-only pause: allows a second chat mutation to win the
      // conversation CAS before worksheet finalization.
      await delayForWorksheetRaceTest();

      const worksheet = result.worksheet;
      const assistantContent = `Your worksheet "${worksheet.title}" is ready.`;

      let assistantMessage;
      try {
        assistantMessage = await runSerializableTransaction(async (tx) => {
          const created =
            action === "regenerate" && preparedWorksheet.targetAssistantMessage
              ? await tx.aIMessage.update({
                  where: { id: preparedWorksheet.targetAssistantMessage.id },
                  data: {
                    content: assistantContent,
                    generationId,
                    videoGenerationId: null,
                    metadata: {
                      type: "WORKSHEET",
                      requestId,
                      worksheet,
                      command: JSON.parse(JSON.stringify(result.command)),
                    },
                  },
                  select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                    userId: true,
                    generationId: true,
                    videoGenerationId: true,
                    parentMessageId: true,
                    metadata: true,
                    attachments: true,
                  },
                })
              : await tx.aIMessage.create({
                  data: {
                    conversationId: preparedWorksheet.conversation.id,
                    userId: user.id,
                    role: "ASSISTANT",
                    content: assistantContent,
                    generationId,
                    parentMessageId: preparedWorksheet.persistedUserMessage.id,
                    metadata: {
                      type: "WORKSHEET",
                      requestId,
                      worksheet,
                      command: JSON.parse(JSON.stringify(result.command)),
                    },
                  },
                  select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                    userId: true,
                    generationId: true,
                    videoGenerationId: true,
                    parentMessageId: true,
                    metadata: true,
                    attachments: true,
                  },
                });

          const updated = await tx.aIConversation.updateMany({
            where: {
              id: preparedWorksheet.conversation.id,
              userId: user.id,
              status: "ACTIVE",
              activeMessageId: preparedWorksheet.expectedActiveMessageId,
            },
            data: {
              updatedAt: new Date(),
              activeMessageId: created.id,
            },
          });

          if (updated.count !== 1) {
            throw new Error("Conversation changed while finalizing.");
          }

          await tx.aIGeneration.update({
            where: { id: generationId },
            data: {
              status: AIGenerationStatus.COMPLETED,
              outputData: {
                worksheet,
                command: JSON.parse(JSON.stringify(result.command)),
              },
              provider: "openai",
              model: "gpt-5",
              creditsUsed: 0,
              completedAt: new Date(),
            },
          });

          return created;
        });
      } catch (error) {
        if (isSerializationConflict(error)) {
          throw new Error("Conversation changed while finalizing.");
        }

        throw error;
      }

      const remainingCredits = await getCreditBalance(user.id);
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(controller) {
          let closed = false;

          const send = (payload: unknown) => {
            if (closed) return;

            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
              );
            } catch {
              closed = true;
            }
          };

          send({
            type: "start",
            action,
            conversationId: preparedWorksheet.conversation.id,
            userMessage: {
              id: preparedWorksheet.persistedUserMessage.id,
              role: preparedWorksheet.persistedUserMessage.role,
              content: preparedWorksheet.persistedUserMessage.content,
              createdAt: preparedWorksheet.persistedUserMessage.createdAt,
            },
            generation: {
              id: generationId,
              type: "WORKSHEET",
              status: "PROCESSING",
            },
          });

          send({
            type: "done",
            action,
            conversationId: preparedWorksheet.conversation.id,
            userMessage: {
              id: preparedWorksheet.persistedUserMessage.id,
              role: preparedWorksheet.persistedUserMessage.role,
              content: preparedWorksheet.persistedUserMessage.content,
              createdAt: preparedWorksheet.persistedUserMessage.createdAt,
            },
            assistantMessage,
            generation: {
              id: generationId,
              type: "WORKSHEET",
              status: "COMPLETED",
              worksheet,
              command: result.command,
            },
            worksheet,
            credits: {
              used: 0,
              remaining: remainingCredits,
            },
            requestId,
          });

          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              // Already closed.
            }
          }
        },

        cancel() {
          // Worksheet generation is completed before this stream is returned.
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    if (intent.intent === "IMAGE") {
      const existingImage = await prisma.aIGeneration.findUnique({
        where: { requestId },
        select: {
          id: true,
          userId: true,
          status: true,
          type: true,
        },
      });

      if (existingImage) {
        if (existingImage.userId === user.id) {
          return errorResponse(
            "This image request has already been submitted.",
            409,
            CHAT_ERROR_CODES.DUPLICATE_GENERATION_REQUEST,
            {
              generationId: existingImage.id,
              status: existingImage.status,
              type: "IMAGE",
            },
          );
        }

        return errorResponse(
          "The request ID is already in use.",
          409,
          CHAT_ERROR_CODES.REQUEST_ID_CONFLICT,
        );
      }

      const preparedImage = await prepareImageChatGeneration({
        userId: user.id,
        conversationId,
        projectId: requestedProjectId,
        message,
        action,
        userMessageId: userMessageId ?? null,
        assistantMessageId: assistantMessageId ?? null,
      });

      const result = await generateImageFromChat({
        userId: user.id,
        prompt: preparedImage.prompt,
        requestId,
        projectId: preparedImage.conversation.projectId ?? undefined,
      });

      const image = result.image;
      const assistantContent = "Your image is ready.";

      const assistantMessage = await runSerializableTransaction(async (tx) => {
        const created =
          action === "regenerate" && preparedImage.targetAssistantMessage
            ? await tx.aIMessage.update({
                where: { id: preparedImage.targetAssistantMessage.id },
                data: {
                  content: assistantContent,
                  generationId: image.generationId,
                  videoGenerationId: null,
                  metadata: {
                    type: "IMAGE",
                    requestId,
                    image: {
                      generationId: image.generationId,
                      assetId: image.assetId,
                      url: image.url,
                      mimeType: image.mimeType,
                      model: image.model,
                      size: image.size,
                      quality: image.quality,
                      prompt: image.prompt,
                    },
                    command: JSON.parse(JSON.stringify(result.command)),
                  },
                },
                select: {
                  id: true,
                  role: true,
                  content: true,
                  createdAt: true,
                  userId: true,
                  generationId: true,
                  videoGenerationId: true,
                  parentMessageId: true,
                  metadata: true,
                  attachments: true,
                },
              })
            : await tx.aIMessage.create({
                data: {
                  conversationId: preparedImage.conversation.id,
                  userId: user.id,
                  role: "ASSISTANT",
                  content: assistantContent,
                  parentMessageId: preparedImage.persistedUserMessage.id,
                  generationId: image.generationId,
                  metadata: {
                    type: "IMAGE",
                    requestId,
                    image: {
                      generationId: image.generationId,
                      assetId: image.assetId,
                      url: image.url,
                      mimeType: image.mimeType,
                      model: image.model,
                      size: image.size,
                      quality: image.quality,
                      prompt: image.prompt,
                    },
                    command: JSON.parse(JSON.stringify(result.command)),
                  },
                },
                select: {
                  id: true,
                  role: true,
                  content: true,
                  createdAt: true,
                  userId: true,
                  generationId: true,
                  videoGenerationId: true,
                  parentMessageId: true,
                  metadata: true,
                  attachments: true,
                },
              });

        const updated = await tx.aIConversation.updateMany({
          where: {
            id: preparedImage.conversation.id,
            userId: user.id,
            status: "ACTIVE",
            activeMessageId: preparedImage.expectedActiveMessageId,
          },
          data: {
            updatedAt: new Date(),
            activeMessageId: created.id,
          },
        });

        if (updated.count !== 1) {
          throw new Error("Conversation changed while finalizing.");
        }

        return created;
      });

      const remainingCredits = await getCreditBalance(user.id);
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(controller) {
          let closed = false;

          const send = (payload: unknown) => {
            if (closed) return;

            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
              );
            } catch {
              closed = true;
            }
          };

          send({
            type: "start",
            action,
            conversationId: preparedImage.conversation.id,
            userMessage: {
              id: preparedImage.persistedUserMessage.id,
              role: preparedImage.persistedUserMessage.role,
              content: preparedImage.persistedUserMessage.content,
              createdAt: preparedImage.persistedUserMessage.createdAt,
            },
            generation: {
              id: image.generationId,
              type: "IMAGE",
              status: "PROCESSING",
              provider: "openai",
              model: image.model,
            },
            credits: {
              used: 0,
              remaining: remainingCredits,
            },
            requestId,
          });

          send({
            type: "done",
            action,
            conversationId: preparedImage.conversation.id,
            userMessage: {
              id: preparedImage.persistedUserMessage.id,
              role: preparedImage.persistedUserMessage.role,
              content: preparedImage.persistedUserMessage.content,
              createdAt: preparedImage.persistedUserMessage.createdAt,
            },
            assistantMessage,
            generation: {
              id: image.generationId,
              type: "IMAGE",
              status: "COMPLETED",
              provider: "openai",
              model: image.model,
              imageUrl: image.url,
              assetId: image.assetId,
              mimeType: image.mimeType,
              size: image.size,
              quality: image.quality,
              prompt: image.prompt,
            },
            image: {
              id: image.assetId,
              generationId: image.generationId,
              url: image.url,
              mimeType: image.mimeType,
              model: image.model,
              size: image.size,
              quality: image.quality,
              prompt: image.prompt,
            },
            command: result.command,
            credits: {
              used: 0,
              remaining: remainingCredits,
            },
            requestId,
          });

          if (!closed) {
            closed = true;

            try {
              controller.close();
            } catch {
              // Already closed.
            }
          }
        },

        cancel() {
          // Image generation is completed before this stream is returned.
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    if (intent.intent === "VIDEO") {
      const existingVideo = await prisma.videoGeneration.findUnique({
        where: { requestId },
        select: { id: true, userId: true, status: true },
      });

      if (existingVideo) {
        if (existingVideo.userId === user.id) {
          return errorResponse(
            "This video request has already been submitted.",
            409,
            CHAT_ERROR_CODES.DUPLICATE_GENERATION_REQUEST,
            {
              generationId: existingVideo.id,
              status: existingVideo.status,
              type: "VIDEO",
            },
          );
        }

        return errorResponse(
          "The request ID is already in use.",
          409,
          CHAT_ERROR_CODES.REQUEST_ID_CONFLICT,
        );
      }

      const preparedVideo = await prepareVideoChatGeneration({
        userId: user.id,
        conversationId,
        projectId: requestedProjectId,
        message,
        action,
        userMessageId: userMessageId ?? null,
        assistantMessageId: assistantMessageId ?? null,
      });

      const command = parseVideoCommand(preparedVideo.prompt);

      await generateVideo({
        userId: user.id,
        prompt: command.prompt,
        duration: command.duration,
        aspectRatio: command.aspectRatio,
        model: command.model,
        requestId,
      });

      const generation = await prisma.videoGeneration.findFirst({
        where: {
          requestId,
          userId: user.id,
        },
      });

      if (!generation) {
        throw new Error(
          "Video generation was created but could not be loaded.",
        );
      }

      const assistantMessage = await runSerializableTransaction(async (tx) => {
        const content =
          generation.status === "COMPLETED"
            ? "Your video is ready."
            : "I’m generating your video now. You can watch it here when it’s ready.";

        const created =
          action === "regenerate" && preparedVideo.targetAssistantMessage
            ? await tx.aIMessage.update({
                where: { id: preparedVideo.targetAssistantMessage.id },
                data: {
                  content,
                  videoGenerationId: generation.id,
                  generationId: null,
                  metadata: Prisma.DbNull,
                },
                select: {
                  id: true,
                  role: true,
                  content: true,
                  createdAt: true,
                  userId: true,
                  videoGenerationId: true,
                },
              })
            : await tx.aIMessage.create({
                data: {
                  conversationId: preparedVideo.conversation.id,
                  userId: user.id,
                  role: "ASSISTANT",
                  content,
                  parentMessageId: preparedVideo.persistedUserMessage.id,
                  videoGenerationId: generation.id,
                },
                select: {
                  id: true,
                  role: true,
                  content: true,
                  createdAt: true,
                  userId: true,
                  videoGenerationId: true,
                },
              });

        const updated = await tx.aIConversation.updateMany({
          where: {
            id: preparedVideo.conversation.id,
            userId: user.id,
            status: "ACTIVE",
            activeMessageId: preparedVideo.expectedActiveMessageId,
          },
          data: {
            updatedAt: new Date(),
            activeMessageId: created.id,
          },
        });

        if (updated.count !== 1) {
          throw new Error("Conversation changed while finalizing.");
        }

        return created;
      });

      const remainingCredits = await getCreditBalance(user.id);

      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(controller) {
          let closed = false;

          const send = (payload: unknown) => {
            if (closed) return;

            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
              );
            } catch {
              closed = true;
            }
          };

          send({
            type: "start",
            conversationId: preparedVideo.conversation.id,
            userMessage: {
              id: preparedVideo.persistedUserMessage.id,
              role: preparedVideo.persistedUserMessage.role,
              content: preparedVideo.persistedUserMessage.content,
              createdAt: preparedVideo.persistedUserMessage.createdAt,
            },
            credits: {
              used: generation.creditsUsed,
              remaining: remainingCredits,
            },
          });

          send({
            type: "done",
            conversationId: preparedVideo.conversation.id,
            userMessage: {
              id: preparedVideo.persistedUserMessage.id,
              role: preparedVideo.persistedUserMessage.role,
              content: preparedVideo.persistedUserMessage.content,
              createdAt: preparedVideo.persistedUserMessage.createdAt,
            },
            assistantMessage: {
              ...assistantMessage,
              videoGenerationId: generation.id,
            },
            generation: {
              id: generation.id,
              type: "VIDEO",
              status: generation.status,
              provider: generation.provider,
              model: generation.model,
              providerTaskId: generation.providerTaskId,
              prompt: generation.prompt,
              duration: generation.duration,
              aspectRatio: generation.aspectRatio,
              creditsUsed: generation.creditsUsed,
              videoUrl:
                generation.status === "COMPLETED"
                  ? `/api/ai/video/${generation.id}/content`
                  : null,
              thumbnailUrl: generation.thumbnailUrl,
              errorMessage: generation.errorMessage,
              createdAt: generation.createdAt,
              updatedAt: generation.updatedAt,
              completedAt: generation.completedAt,
            },
            video: {
              id: generation.id,
              status: generation.status,
              provider: generation.provider,
              model: generation.model,
              providerTaskId: generation.providerTaskId,
              duration: generation.duration,
              aspectRatio: generation.aspectRatio,
              videoUrl:
                generation.status === "COMPLETED"
                  ? `/api/ai/video/${generation.id}/content`
                  : null,
            },
            credits: {
              used: generation.creditsUsed,
              remaining: remainingCredits,
            },
            requestId,
          });

          if (!closed) {
            closed = true;

            try {
              controller.close();
            } catch {
              // Already closed.
            }
          }
        },

        cancel() {
          // Nothing to cancel. The Sora generation continues asynchronously.
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const resolvedAttachments =
      action === "send"
        ? await resolveChatAttachments(user.id, attachmentAssetIds)
        : [];

    const effectiveMessage =
      message ||
      (resolvedAttachments.length > 0
        ? "Please analyze the attached file(s)."
        : message);

    /*
     * Generic CHAT request-id fast path.
     *
     * Specialized generation handlers above own their request-id lifecycle:
     *   - WORKSHEET -> AIMessage metadata
     *   - VIDEO     -> VideoGeneration
     *   - IMAGE     -> AIGeneration created by the image generator
     *
     * Only the generic CHAT path reaches this fallback.
     */
    const existingGeneration = await prisma.aIGeneration.findUnique({
      where: {
        requestId,
      },
      select: {
        id: true,
        status: true,
        userId: true,
      },
    });

    if (existingGeneration) {
      if (existingGeneration.userId === user.id) {
        return errorResponse(
          "This AI request has already been submitted.",
          409,
          CHAT_ERROR_CODES.DUPLICATE_GENERATION_REQUEST,
          {
            generationId: existingGeneration.id,
            status: existingGeneration.status,
          },
        );
      }

      return errorResponse(
        "The request ID is already in use.",
        409,
        CHAT_ERROR_CODES.REQUEST_ID_CONFLICT,
      );
    }

    const prepared = await runSerializableTransaction(async (tx) => {
      const conversation = conversationId
        ? await tx.aIConversation.findFirst({
            where: {
              id: conversationId,
              userId: user.id,
              status: "ACTIVE",
              ...(requestedProjectId ? { projectId: requestedProjectId } : {}),
            },
          })
        : await tx.aIConversation.create({
            data: {
              userId: user.id,
              projectId: requestedProjectId,
              title: createConversationTitle(effectiveMessage),
              model: process.env.OPENAI_CHAT_MODEL || "gpt-5-mini",
              status: "ACTIVE",
            },
          });

      if (!conversation) {
        throw new Error("Conversation not found.");
      }

      const foreignMessageCount = await tx.aIMessage.count({
        where: {
          conversationId: conversation.id,
          NOT: {
            userId: user.id,
          },
        },
      });

      if (foreignMessageCount > 0) {
        throw new Error(
          "Conversation message ownership integrity check failed.",
        );
      }

      const latestMessages = await loadConversationContext(
        tx,
        conversation.id,
        user.id,
        conversation.activeMessageId,
        CONTEXT_MESSAGE_LIMIT,
      );

      let targetUserMessage: ChatMessageRecord | null = null;
      let targetAssistantMessage: ChatMessageRecord | null = null;
      let aiContextRecords: ChatMessageRecord[];
      let prompt: string;

      if (action === "send") {
        aiContextRecords = latestMessages;
        prompt = effectiveMessage;
      } else if (action === "edit") {
        if (!userMessageId) {
          throw new Error("User message ID is required for editing.");
        }

        const editUserMessageId = userMessageId;

        const foundUserMessage = await tx.aIMessage.findFirst({
          where: {
            id: editUserMessageId,
            conversationId: conversation.id,
            userId: user.id,
            role: "USER",
          },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            userId: true,
            generationId: true,
            videoGenerationId: true,
            parentMessageId: true,
            metadata: true,
            attachments: true,
          },
        });

        if (!foundUserMessage) {
          throw new Error("User message not found.");
        }

        targetUserMessage = foundUserMessage;

        aiContextRecords = await loadConversationContext(
          tx,
          conversation.id,
          user.id,
          foundUserMessage.parentMessageId,
          CONTEXT_MESSAGE_LIMIT,
        );

        prompt = message;
      } else {
        if (!assistantMessageId) {
          throw new Error("Assistant message ID is required for regeneration.");
        }

        const targetAssistant = await tx.aIMessage.findFirst({
          where: {
            id: assistantMessageId,
            conversationId: conversation.id,
            userId: user.id,
            role: "ASSISTANT",
          },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            userId: true,
            generationId: true,
            videoGenerationId: true,
            parentMessageId: true,
            metadata: true,
            attachments: true,
          },
        });

        const latestMessage = conversation.activeMessageId
          ? await tx.aIMessage.findFirst({
              where: {
                id: conversation.activeMessageId,
                conversationId: conversation.id,
                userId: user.id,
              },
              select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
                userId: true,
                generationId: true,
                videoGenerationId: true,
                parentMessageId: true,
              },
            })
          : null;

        if (
          !targetAssistant ||
          !latestMessage ||
          latestMessage.id !== assistantMessageId
        ) {
          throw new Error(
            "Only the latest assistant message can be regenerated.",
          );
        }

        const precedingUserMessage = targetAssistant.parentMessageId
          ? await tx.aIMessage.findFirst({
              where: {
                id: targetAssistant.parentMessageId,
                conversationId: conversation.id,
                userId: user.id,
                role: "USER",
              },
              select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
                userId: true,
                generationId: true,
                videoGenerationId: true,
                parentMessageId: true,
              },
            })
          : null;

        if (!precedingUserMessage) {
          throw new Error(
            "The assistant message is not paired with a user message.",
          );
        }

        targetAssistantMessage = targetAssistant;
        targetUserMessage = precedingUserMessage;

        if (!targetAssistantMessage.generationId) {
          if (targetAssistantMessage.videoGenerationId) {
            throw new Error(
              "This assistant message is a video generation and must use the specialized video path.",
            );
          }

          throw new Error(
            "Assistant message generation relationship is missing.",
          );
        }

        aiContextRecords = await loadConversationContext(
          tx,
          conversation.id,
          user.id,
          targetAssistant.parentMessageId,
          CONTEXT_MESSAGE_LIMIT,
        );

        prompt = precedingUserMessage.content;
      }

      const aiMessages = buildBoundedAIContext(aiContextRecords);

      const finalAIInput =
        action === "send" || action === "edit"
          ? [
              ...aiMessages,
              {
                role: "user" as const,
                content: buildAIMessageContent(prompt, resolvedAttachments),
              },
            ]
          : aiMessages;

      await enforceAIRateLimit(tx, user.id);

      await enforceAIConcurrencyLimit(tx, user.id);

      /*
       * Claim requestId FIRST inside this same transaction.
       */
      const generation = await tx.aIGeneration.create({
        data: {
          userId: user.id,
          projectId: conversation.projectId,
          type: AIGenerationType.TEXT,
          status: AIGenerationStatus.PENDING,
          prompt: prompt.trim(),
          requestId,
          creditOperation: "CHAT",
          inputData: {
            operation: "CHAT",
            conversationId: conversation.id,
            messageCount: finalAIInput.length,
            action,
            userMessageId: targetUserMessage?.id ?? null,
            assistantMessageId: targetAssistantMessage?.id ?? null,
            editMessageId:
              action === "edit" ? (targetUserMessage?.id ?? null) : null,
          },
          creditsUsed: 0,
        },
        select: {
          id: true,
          projectId: true,
          userId: true,
        },
      });

      let persistedUserMessage = targetUserMessage;

      if (action === "edit" && targetUserMessage) {
        persistedUserMessage = await replaceEditedUserMessage(
          tx,
          conversation.id,
          user.id,
          targetUserMessage.id,
          prompt,
        );

        const activated = await tx.aIConversation.updateMany({
          where: { id: conversation.id, userId: user.id, status: "ACTIVE" },
          data: {
            activeMessageId: persistedUserMessage.id,
            updatedAt: new Date(),
          },
        });

        if (activated.count !== 1) {
          throw new Error("Conversation could not be updated after editing.");
        }
      }

      if (!persistedUserMessage && action === "send") {
        persistedUserMessage = await tx.aIMessage.create({
          data: {
            conversationId: conversation.id,
            userId: user.id,
            role: "USER",
            content: prompt,
            parentMessageId: conversation.activeMessageId,
            attachments:
              resolvedAttachments.length > 0 ? resolvedAttachments : undefined,
          },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            userId: true,
            generationId: true,
            videoGenerationId: true,
            parentMessageId: true,
            metadata: true,
            attachments: true,
          },
        });

        const activated = await tx.aIConversation.updateMany({
          where: {
            id: conversation.id,
            userId: user.id,
            status: "ACTIVE",
            activeMessageId: conversation.activeMessageId,
          },
          data: {
            activeMessageId: persistedUserMessage.id,
          },
        });

        if (activated.count !== 1) {
          throw new Error(
            "Conversation changed while sending. Please resubmit your message.",
          );
        }
      }

      if (!persistedUserMessage) {
        throw new Error("Unable to persist the user message.");
      }

      return {
        conversation: {
          id: conversation.id,
          projectId: conversation.projectId,
        },
        generation,
        persistedUserMessage,
        aiMessages: finalAIInput,
        prompt,
        assistantMessageId:
          action === "regenerate" ? targetAssistantMessage!.id : null,
        expectedActiveMessageId:
          action === "regenerate"
            ? targetAssistantMessage!.id
            : persistedUserMessage.id,
        action,
      };
    });

    return await streamChatGeneration({
      request,
      user,
      conversation: prepared.conversation,
      userMessage: prepared.persistedUserMessage,
      aiMessages: prepared.aiMessages,
      prompt: prepared.prompt,
      assistantMessageId: prepared.assistantMessageId,
      expectedActiveMessageId: prepared.expectedActiveMessageId,
      action: prepared.action,
      requestId,
      generationId: prepared.generation.id,
    });
  } catch (error) {
    if (worksheetGenerationId) {
      try {
        await prisma.aIGeneration.updateMany({
          where: {
            id: worksheetGenerationId,
            status: {
              in: [AIGenerationStatus.PENDING, AIGenerationStatus.PROCESSING],
            },
          },
          data: {
            status: AIGenerationStatus.FAILED,
            errorMessage:
              error instanceof Error
                ? error.message
                : "Worksheet generation failed.",
            completedAt: new Date(),
          },
        });
      } catch (settlementError) {
        console.error(
          "Failed to settle worksheet generation:",
          settlementError,
        );
      }
    }

    if (isPrismaUniqueConstraintError(error)) {
      const normalizedRequestId =
        typeof requestId === "string" && requestId.trim()
          ? requestId.trim()
          : "__invalid__";

      const existingGeneration = await prisma.aIGeneration.findFirst({
        where: {
          requestId: normalizedRequestId,
        },
        select: {
          id: true,
          status: true,
          userId: true,
          type: true,
        },
      });

      if (existingGeneration) {
        if (existingGeneration.userId === authenticatedUserId) {
          return errorResponse(
            "This AI request has already been submitted.",
            409,
            CHAT_ERROR_CODES.DUPLICATE_GENERATION_REQUEST,
            {
              generationId: existingGeneration.id,
              status: existingGeneration.status,
              type: existingGeneration.type,
            },
          );
        }

        return errorResponse(
          "The request ID is already in use.",
          409,
          CHAT_ERROR_CODES.REQUEST_ID_CONFLICT,
        );
      }

      const existingVideoGeneration = await prisma.videoGeneration.findFirst({
        where: {
          requestId: normalizedRequestId,
        },
        select: {
          id: true,
          status: true,
          userId: true,
        },
      });

      if (existingVideoGeneration) {
        if (existingVideoGeneration.userId === authenticatedUserId) {
          return errorResponse(
            "This video request has already been submitted.",
            409,
            CHAT_ERROR_CODES.DUPLICATE_GENERATION_REQUEST,
            {
              generationId: existingVideoGeneration.id,
              status: existingVideoGeneration.status,
              type: "VIDEO",
            },
          );
        }

        return errorResponse(
          "The request ID is already in use.",
          409,
          CHAT_ERROR_CODES.REQUEST_ID_CONFLICT,
        );
      }

      return errorResponse(
        "The request could not be created because its request ID is already in use.",
        409,
        CHAT_ERROR_CODES.REQUEST_ID_CONFLICT,
      );
    }

    if (isInsufficientVideoCreditsError(error)) {
      return errorResponse(
        "Insufficient AI credits.",
        402,
        CHAT_ERROR_CODES.INSUFFICIENT_AI_CREDITS,
        {
          required: error.required,
          available: error.available,
        },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return errorResponse(
        "The conversation changed while your request was being processed. Please resubmit your message.",
        409,
        CHAT_ERROR_CODES.CONVERSATION_CHANGED,
      );
    }

    if (error instanceof InsufficientAICreditsError) {
      return errorResponse(
        "Insufficient AI credits.",
        402,
        CHAT_ERROR_CODES.INSUFFICIENT_AI_CREDITS,
        {
          required: error.required,
          available: error.available,
        },
      );
    }

    if (isAIError(error)) {
      return aiErrorResponse(error);
    }

    if (error instanceof Error && error.message === "Generation cancelled.") {
      return errorResponse(
        "Generation cancelled.",
        499,
        CHAT_ERROR_CODES.GENERATION_CANCELLED,
      );
    }

    if (
      error instanceof Error &&
      (error.message === "Conversation not found." ||
        error.message === "User message not found." ||
        error.message ===
          "Only the latest assistant message can be regenerated." ||
        error.message ===
          "The assistant message is not paired with a user message." ||
        error.message ===
          "Assistant message ID is required for regeneration." ||
        error.message ===
          "Conversation message ownership integrity check failed." ||
        error.message === "User message ownership check failed." ||
        error.message === "Assistant message ownership check failed." ||
        error.message ===
          "Assistant message generation relationship is missing." ||
        error.message ===
          "Assistant message could not be loaded after update." ||
        error.message === "AI generation not found." ||
        error.message === "AI generation request identity mismatch." ||
        error.message === "Conversation could not be updated after editing." ||
        error.message ===
          "Conversation changed while sending. Please resubmit your message." ||
        error.message === "Conversation changed while finalizing." ||
        error.message === "The request ID is already in use.")
    ) {
      return errorResponse(
        error.message,
        400,
        CHAT_ERROR_CODES.INVALID_REQUEST,
      );
    }

    if (error instanceof AIRateLimitError) {
      return new NextResponse(
        JSON.stringify({
          error: error.message,
          code: CHAT_ERROR_CODES.RATE_LIMITED,
          retryAfter: error.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Retry-After": String(error.retryAfterSeconds),
          },
        },
      );
    }

    console.error("POST /api/ai/chat:", error);

    return errorResponse(
      "Unable to process your request.",
      500,
      CHAT_ERROR_CODES.INTERNAL_ERROR,
    );
  }
}

async function prepareImageChatGeneration({
  userId,
  conversationId,
  projectId,
  message,
  action,
  userMessageId,
  assistantMessageId,
}: {
  userId: string;
  conversationId: string | null;
  projectId: string | null;
  message: string;
  action: ChatAction;
  userMessageId: string | null;
  assistantMessageId: string | null;
}) {
  return runSerializableTransaction(async (tx) => {
    const conversation = conversationId
      ? await tx.aIConversation.findFirst({
          where: {
            id: conversationId,
            userId,
            status: "ACTIVE",
            ...(projectId ? { projectId } : {}),
          },
        })
      : await tx.aIConversation.create({
          data: {
            userId,
            projectId,
            title: createConversationTitle(message),
            model: process.env.OPENAI_CHAT_MODEL || "gpt-5-mini",
            status: "ACTIVE",
          },
        });

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const foreignMessageCount = await tx.aIMessage.count({
      where: {
        conversationId: conversation.id,
        NOT: { userId },
      },
    });

    if (foreignMessageCount > 0) {
      throw new Error("Conversation message ownership integrity check failed.");
    }

    let targetUserMessage: ChatMessageRecord | null = null;

    let targetAssistantMessage: {
      id: string;
      parentMessageId: string | null;
    } | null = null;

    let prompt = message;

    if (action === "send") {
      prompt = message;
    } else if (action === "edit") {
      if (!userMessageId) {
        throw new Error("User message ID is required for editing.");
      }

      const foundUserMessage = await tx.aIMessage.findFirst({
        where: {
          id: userMessageId,
          conversationId: conversation.id,
          userId,
          role: "USER",
        },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          userId: true,
          generationId: true,
          videoGenerationId: true,
          parentMessageId: true,
          metadata: true,
        },
      });

      if (!foundUserMessage) {
        throw new Error("User message not found.");
      }

      targetUserMessage = foundUserMessage;
      prompt = message;
    } else {
      if (!assistantMessageId) {
        throw new Error("Assistant message ID is required for regeneration.");
      }

      const targetAssistant = await tx.aIMessage.findFirst({
        where: {
          id: assistantMessageId,
          conversationId: conversation.id,
          userId,
          role: "ASSISTANT",
        },
        select: {
          id: true,
          parentMessageId: true,
          metadata: true,
        },
      });

      const latestMessage = conversation.activeMessageId
        ? await tx.aIMessage.findFirst({
            where: {
              id: conversation.activeMessageId,
              conversationId: conversation.id,
              userId,
            },
            select: { id: true },
          })
        : null;

      if (
        !targetAssistant ||
        !latestMessage ||
        latestMessage.id !== assistantMessageId
      ) {
        throw new Error(
          "Only the latest assistant message can be regenerated.",
        );
      }

      const metadata = targetAssistant.metadata;

      const metadataType =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? (metadata as { type?: unknown }).type
          : undefined;

      if (metadataType !== "IMAGE") {
        throw new Error("Assistant message is not an image generation.");
      }

      const precedingUserMessage = targetAssistant.parentMessageId
        ? await tx.aIMessage.findFirst({
            where: {
              id: targetAssistant.parentMessageId,
              conversationId: conversation.id,
              userId,
              role: "USER",
            },
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
              userId: true,
              generationId: true,
              videoGenerationId: true,
              parentMessageId: true,
              metadata: true,
            },
          })
        : null;

      if (!precedingUserMessage) {
        throw new Error(
          "The assistant message is not paired with a user message.",
        );
      }

      targetAssistantMessage = {
        id: targetAssistant.id,
        parentMessageId: targetAssistant.parentMessageId,
      };

      targetUserMessage = precedingUserMessage;
      prompt = precedingUserMessage.content;
    }

    let persistedUserMessage = targetUserMessage;

    if (action === "edit" && targetUserMessage) {
      persistedUserMessage = await replaceEditedUserMessage(
        tx,
        conversation.id,
        userId,
        targetUserMessage.id,
        prompt,
      );

      const activated = await tx.aIConversation.updateMany({
        where: { id: conversation.id, userId, status: "ACTIVE" },
        data: {
          activeMessageId: persistedUserMessage.id,
          updatedAt: new Date(),
        },
      });

      if (activated.count !== 1) {
        throw new Error("Conversation could not be updated after editing.");
      }
    }

    if (!persistedUserMessage && action === "send") {
      persistedUserMessage = await tx.aIMessage.create({
        data: {
          conversationId: conversation.id,
          userId,
          role: "USER",
          content: prompt,
          parentMessageId: conversation.activeMessageId,
        },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          userId: true,
          generationId: true,
          videoGenerationId: true,
          parentMessageId: true,
          metadata: true,
        },
      });

      const activated = await tx.aIConversation.updateMany({
        where: {
          id: conversation.id,
          userId,
          status: "ACTIVE",
          activeMessageId: conversation.activeMessageId,
        },
        data: {
          activeMessageId: persistedUserMessage.id,
        },
      });

      if (activated.count !== 1) {
        throw new Error(
          "Conversation changed while sending. Please resubmit your message.",
        );
      }
    }

    if (!persistedUserMessage) {
      throw new Error("Unable to persist the user message.");
    }

    return {
      conversation: {
        id: conversation.id,
        projectId: conversation.projectId,
      },
      persistedUserMessage,
      targetAssistantMessage,
      prompt,
      expectedActiveMessageId:
        action === "regenerate"
          ? targetAssistantMessage!.id
          : persistedUserMessage.id,
    };
  });
}

async function prepareWorksheetChatGeneration({
  userId,
  conversationId,
  projectId,
  message,
  action,
  userMessageId,
  assistantMessageId,
}: {
  userId: string;
  conversationId: string | null;
  projectId: string | null;
  message: string;
  action: ChatAction;
  userMessageId: string | null;
  assistantMessageId: string | null;
}) {
  return runSerializableTransaction(async (tx) => {
    const conversation = conversationId
      ? await tx.aIConversation.findFirst({
          where: {
            id: conversationId,
            userId,
            status: "ACTIVE",
            ...(projectId ? { projectId } : {}),
          },
        })
      : await tx.aIConversation.create({
          data: {
            userId,
            projectId,
            title: createConversationTitle(message),
            model: process.env.OPENAI_CHAT_MODEL || "gpt-5-mini",
            status: "ACTIVE",
          },
        });

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const foreignMessageCount = await tx.aIMessage.count({
      where: { conversationId: conversation.id, NOT: { userId } },
    });

    if (foreignMessageCount > 0) {
      throw new Error("Conversation message ownership integrity check failed.");
    }

    let targetUserMessage: ChatMessageRecord | null = null;
    let targetAssistantMessage: {
      id: string;
      parentMessageId: string | null;
    } | null = null;
    let prompt = message;

    if (action === "send") {
      prompt = message;
    } else if (action === "edit") {
      if (!userMessageId) {
        throw new Error("User message ID is required for editing.");
      }

      const foundUserMessage = await tx.aIMessage.findFirst({
        where: {
          id: userMessageId,
          conversationId: conversation.id,
          userId,
          role: "USER",
        },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          userId: true,
          generationId: true,
          videoGenerationId: true,
          parentMessageId: true,
        },
      });

      if (!foundUserMessage) {
        throw new Error("User message not found.");
      }

      targetUserMessage = foundUserMessage;
      prompt = message;
    } else {
      if (!assistantMessageId) {
        throw new Error("Assistant message ID is required for regeneration.");
      }

      const targetAssistant = await tx.aIMessage.findFirst({
        where: {
          id: assistantMessageId,
          conversationId: conversation.id,
          userId,
          role: "ASSISTANT",
        },
        select: {
          id: true,
          parentMessageId: true,
          metadata: true,
        },
      });

      const latestMessage = conversation.activeMessageId
        ? await tx.aIMessage.findFirst({
            where: {
              id: conversation.activeMessageId,
              conversationId: conversation.id,
              userId,
            },
            select: { id: true },
          })
        : null;

      if (
        !targetAssistant ||
        !latestMessage ||
        latestMessage.id !== assistantMessageId
      ) {
        throw new Error(
          "Only the latest assistant message can be regenerated.",
        );
      }

      const metadata = targetAssistant.metadata;
      const metadataType =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? (metadata as { type?: unknown }).type
          : undefined;

      if (metadataType !== "WORKSHEET") {
        throw new Error("Assistant message is not a worksheet generation.");
      }

      const precedingUserMessage = targetAssistant.parentMessageId
        ? await tx.aIMessage.findFirst({
            where: {
              id: targetAssistant.parentMessageId,
              conversationId: conversation.id,
              userId,
              role: "USER",
            },
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
              userId: true,
              generationId: true,
              videoGenerationId: true,
              parentMessageId: true,
            },
          })
        : null;

      if (!precedingUserMessage) {
        throw new Error(
          "The assistant message is not paired with a user message.",
        );
      }

      targetAssistantMessage = {
        id: targetAssistant.id,
        parentMessageId: targetAssistant.parentMessageId,
      };
      targetUserMessage = precedingUserMessage;
      prompt = precedingUserMessage.content;
    }

    let persistedUserMessage = targetUserMessage;

    if (action === "edit" && targetUserMessage) {
      persistedUserMessage = await replaceEditedUserMessage(
        tx,
        conversation.id,
        userId,
        targetUserMessage.id,
        prompt,
      );

      const activated = await tx.aIConversation.updateMany({
        where: { id: conversation.id, userId, status: "ACTIVE" },
        data: {
          activeMessageId: persistedUserMessage.id,
          updatedAt: new Date(),
        },
      });

      if (activated.count !== 1) {
        throw new Error("Conversation could not be updated after editing.");
      }
    }

    if (!persistedUserMessage && action === "send") {
      persistedUserMessage = await tx.aIMessage.create({
        data: {
          conversationId: conversation.id,
          userId,
          role: "USER",
          content: prompt,
          parentMessageId: conversation.activeMessageId,
        },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          userId: true,
          generationId: true,
          videoGenerationId: true,
          parentMessageId: true,
        },
      });

      const activated = await tx.aIConversation.updateMany({
        where: {
          id: conversation.id,
          userId,
          status: "ACTIVE",
          activeMessageId: conversation.activeMessageId,
        },
        data: { activeMessageId: persistedUserMessage.id },
      });

      if (activated.count !== 1) {
        throw new Error(
          "Conversation changed while sending. Please resubmit your message.",
        );
      }
    }

    if (!persistedUserMessage) {
      throw new Error("Unable to persist the user message.");
    }

    return {
      conversation: {
        id: conversation.id,
        projectId: conversation.projectId,
      },
      persistedUserMessage,
      targetAssistantMessage,
      prompt,
      expectedActiveMessageId:
        action === "regenerate"
          ? targetAssistantMessage!.id
          : persistedUserMessage.id,
    };
  });
}

async function prepareVideoChatGeneration({
  userId,
  conversationId,
  projectId,
  message,
  action,
  userMessageId,
  assistantMessageId,
}: {
  userId: string;
  conversationId: string | null;
  projectId: string | null;
  message: string;
  action: ChatAction;
  userMessageId: string | null;
  assistantMessageId: string | null;
}) {
  return runSerializableTransaction(async (tx) => {
    const conversation = conversationId
      ? await tx.aIConversation.findFirst({
          where: {
            id: conversationId,
            userId,
            status: "ACTIVE",
            ...(projectId ? { projectId } : {}),
          },
        })
      : await tx.aIConversation.create({
          data: {
            userId,
            projectId,
            title: createConversationTitle(message),
            model: process.env.OPENAI_CHAT_MODEL || "gpt-5-mini",
            status: "ACTIVE",
          },
        });

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const foreignMessageCount = await tx.aIMessage.count({
      where: { conversationId: conversation.id, NOT: { userId } },
    });

    if (foreignMessageCount > 0) {
      throw new Error("Conversation message ownership integrity check failed.");
    }

    let targetUserMessage: ChatMessageRecord | null = null;
    let targetAssistantMessage: {
      id: string;
      videoGenerationId: string | null;
    } | null = null;
    let prompt = message;

    if (action === "send") {
      prompt = message;
    } else if (action === "edit") {
      if (!userMessageId) {
        throw new Error("User message ID is required for editing.");
      }

      const foundUserMessage = await tx.aIMessage.findFirst({
        where: {
          id: userMessageId,
          conversationId: conversation.id,
          userId,
          role: "USER",
        },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          userId: true,
          generationId: true,
          videoGenerationId: true,
          parentMessageId: true,
        },
      });

      if (!foundUserMessage) {
        throw new Error("User message not found.");
      }

      targetUserMessage = foundUserMessage;
      prompt = message;
    } else {
      if (!assistantMessageId) {
        throw new Error("Assistant message ID is required for regeneration.");
      }

      const targetAssistant = await tx.aIMessage.findFirst({
        where: {
          id: assistantMessageId,
          conversationId: conversation.id,
          userId,
          role: "ASSISTANT",
        },
        select: {
          id: true,
          parentMessageId: true,
          videoGenerationId: true,
        },
      });

      const latestMessage = conversation.activeMessageId
        ? await tx.aIMessage.findFirst({
            where: {
              id: conversation.activeMessageId,
              conversationId: conversation.id,
              userId,
            },
            select: { id: true },
          })
        : null;

      if (
        !targetAssistant ||
        !latestMessage ||
        latestMessage.id !== assistantMessageId
      ) {
        throw new Error(
          "Only the latest assistant message can be regenerated.",
        );
      }

      const precedingUserMessage = targetAssistant.parentMessageId
        ? await tx.aIMessage.findFirst({
            where: {
              id: targetAssistant.parentMessageId,
              conversationId: conversation.id,
              userId,
              role: "USER",
            },
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
              userId: true,
              generationId: true,
              parentMessageId: true,
            },
          })
        : null;

      if (!precedingUserMessage) {
        throw new Error(
          "The assistant message is not paired with a user message.",
        );
      }

      if (!targetAssistant.videoGenerationId) {
        throw new Error(
          "Assistant message is not linked to a video generation.",
        );
      }

      targetAssistantMessage = targetAssistant;
      targetUserMessage = precedingUserMessage;
      prompt = precedingUserMessage.content;
    }

    let persistedUserMessage = targetUserMessage;

    if (action === "edit" && targetUserMessage) {
      persistedUserMessage = await replaceEditedUserMessage(
        tx,
        conversation.id,
        userId,
        targetUserMessage.id,
        prompt,
      );

      const activated = await tx.aIConversation.updateMany({
        where: { id: conversation.id, userId, status: "ACTIVE" },
        data: {
          activeMessageId: persistedUserMessage.id,
          updatedAt: new Date(),
        },
      });

      if (activated.count !== 1) {
        throw new Error("Conversation could not be updated after editing.");
      }
    }

    if (!persistedUserMessage && action === "send") {
      persistedUserMessage = await tx.aIMessage.create({
        data: {
          conversationId: conversation.id,
          userId,
          role: "USER",
          content: prompt,
          parentMessageId: conversation.activeMessageId,
        },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          userId: true,
          generationId: true,
          videoGenerationId: true,
          parentMessageId: true,
        },
      });

      const activated = await tx.aIConversation.updateMany({
        where: {
          id: conversation.id,
          userId,
          status: "ACTIVE",
          activeMessageId: conversation.activeMessageId,
        },
        data: { activeMessageId: persistedUserMessage.id },
      });

      if (activated.count !== 1) {
        throw new Error(
          "Conversation changed while sending. Please resubmit your message.",
        );
      }
    }

    if (!persistedUserMessage) {
      throw new Error("Unable to persist the user message.");
    }

    return {
      conversation: {
        id: conversation.id,
        projectId: conversation.projectId,
      },
      persistedUserMessage,
      targetAssistantMessage,
      prompt,
      expectedActiveMessageId:
        action === "regenerate"
          ? targetAssistantMessage!.id
          : persistedUserMessage.id,
    };
  });
}

async function streamChatGeneration({
  request,
  user,
  conversation,
  userMessage,
  aiMessages,
  prompt,
  assistantMessageId,
  expectedActiveMessageId,
  action,
  requestId,
  generationId,
}: {
  request: Request;
  user: { id: string };
  conversation: {
    id: string;
    projectId: string | null;
  };
  userMessage: ChatMessageRecord;
  aiMessages: AIChatMessage[];
  prompt: string;
  assistantMessageId: string | null;
  expectedActiveMessageId: string;
  action: ChatAction;
  requestId: string;
  generationId: string;
}) {
  const generation = await streamAI({
    userId: user.id,
    operation: "CHAT",
    prompt,
    messages: aiMessages,
    projectId: conversation.projectId,
    inputData: {
      operation: "CHAT",
      conversationId: conversation.id,
      messageCount: aiMessages.length,
      action,
      userMessageId: userMessage.id,
      assistantMessageId,
      requestId,
    },
    requestId,
    generationId,
    signal: request.signal,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let closed = false;
      let finalized = false;

      const send = (payload: unknown) => {
        if (closed) return;

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          // Client disconnected.
        }
      };

      const close = () => {
        if (closed) return;

        closed = true;

        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      /*
       * IMPORTANT:
       *
       * Use const with the value initialized directly.
       * This eliminates the prefer-const lint error and avoids
       * an unnecessarily mutable variable.
       */
      const persistAssistant = async (text: string) =>
        generation.finalize(text, async (tx) => {
          const persistedAssistantMessage =
            action === "regenerate" && assistantMessageId
              ? await tx.aIMessage.update({
                  where: { id: assistantMessageId },
                  data: {
                    content: text,
                    generationId: generation.generationId,
                  },
                  select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                    userId: true,
                  },
                })
              : await tx.aIMessage.create({
                  data: {
                    conversationId: conversation.id,
                    userId: user.id,
                    role: "ASSISTANT",
                    content: text,
                    generationId: generation.generationId,
                    parentMessageId: userMessage.id,
                  },
                  select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                    userId: true,
                  },
                });

          const conversationUpdated = await tx.aIConversation.updateMany({
            where: {
              id: conversation.id,
              userId: user.id,
              status: "ACTIVE",
              activeMessageId: expectedActiveMessageId,
            },
            data: {
              updatedAt: new Date(),
              model: generation.model,
              activeMessageId: persistedAssistantMessage.id,
            },
          });

          if (conversationUpdated.count !== 1) {
            throw new Error("Conversation changed while finalizing.");
          }

          return persistedAssistantMessage;
        });

      try {
        send({
          type: "start",
          action,
          conversationId: conversation.id,
          userMessage: {
            id: userMessage.id,
            role: userMessage.role,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
            attachments: clientAttachments(userMessage.attachments),
          },
          generation: {
            id: generation.generationId,
            type: "TEXT",
            status: "PROCESSING",
            creditsUsed: generation.creditsUsed,
            provider: generation.provider,
            model: generation.model,
          },
          credits: {
            used: generation.creditsUsed,
            remaining: generation.creditsRemaining,
          },
        });

        for await (const chunk of generation.stream) {
          if (!chunk) continue;

          fullText += chunk;

          send({
            type: "delta",
            delta: chunk,
          });
        }

        if (!fullText.trim()) {
          throw new Error("AI returned an empty response.");
        }

        const assistantMessage = await persistAssistant(fullText);

        finalized = true;

        send({
          type: "done",
          action,
          conversationId: conversation.id,
          userMessage: {
            ...serializeChatMessage(userMessage),
          },
          assistantMessage,
          generation: {
            id: generation.generationId,
            type: "TEXT",
            status: "COMPLETED",
            creditsUsed: generation.creditsUsed,
            provider: generation.provider,
            model: generation.model,
          },
          credits: {
            used: generation.creditsUsed,
            remaining: generation.creditsRemaining,
          },
        });
      } catch (error) {
        const cancelled =
          request.signal.aborted ||
          (error instanceof Error && error.message === "Generation cancelled.");

        if (cancelled && !finalized && fullText.trim()) {
          try {
            const assistantMessage = await persistAssistant(fullText);

            finalized = true;

            send({
              type: "done",
              action,
              conversationId: conversation.id,
              userMessage,
              assistantMessage,
              generation: {
                id: generation.generationId,
                type: "TEXT",
                status: "COMPLETED",
                stopped: true,
                creditsUsed: generation.creditsUsed,
                provider: generation.provider,
                model: generation.model,
              },
              credits: {
                used: generation.creditsUsed,
                remaining: generation.creditsRemaining,
              },
            });
          } catch (finalizeError) {
            console.error(
              "Failed to persist stopped AI response:",
              finalizeError,
            );

            await generation.fail(finalizeError);
          }
        } else if (cancelled && !finalized) {
          await generation.fail(
            new Error("Generation cancelled before any response was produced."),
          );
        } else if (!finalized && !cancelled) {
          await generation.fail(error);
        }

        if (!closed && !cancelled) {
          if (isAIError(error)) {
            send({
              type: "error",
              ...serializeAIError(error),
            });
          } else {
            send({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "AI generation failed.",
              code: CHAT_ERROR_CODES.GENERATION_FAILED,
            });
          }
        }
      } finally {
        close();
      }
    },

    cancel() {
      // Request cancellation is handled by the generation signal above.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function DELETE(request: Request) {
  let action: "archive" | "delete" = "archive";

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { searchParams } = new URL(request.url);

    const conversationId = searchParams.get("conversationId");
    action = searchParams.get("action") === "delete" ? "delete" : "archive";

    if (!conversationId) {
      return errorResponse(
        "Conversation ID is required.",
        400,
        CHAT_ERROR_CODES.INVALID_REQUEST,
      );
    }

    if (action === "delete") {
      const deleted = await prisma.$transaction(async (tx) => {
        const conversation = await tx.aIConversation.findFirst({
          where: {
            id: conversationId,
            userId: user.id,
          },
          select: { id: true },
        });

        if (!conversation) return false;

        await tx.aIConversation.update({
          where: { id: conversationId },
          data: { activeMessageId: null },
        });

        await tx.aIMessage.updateMany({
          where: { conversationId, userId: user.id },
          data: { parentMessageId: null },
        });

        await tx.aIMessage.deleteMany({
          where: { conversationId, userId: user.id },
        });

        await tx.aIConversation.delete({
          where: { id: conversationId },
        });

        return true;
      });

      if (!deleted) {
        return errorResponse(
          "Conversation not found.",
          404,
          CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND,
        );
      }

      return NextResponse.json(
        { success: true, conversationId, action: "delete" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    /* Atomic ACTIVE -> ARCHIVED transition. */
    const archived = await prisma.aIConversation.updateMany({
      where: {
        id: conversationId,
        userId: user.id,
        status: "ACTIVE",
      },
      data: { status: "ARCHIVED" },
    });

    if (archived.count !== 1) {
      return errorResponse(
        "Conversation not found.",
        404,
        CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND,
      );
    }

    return NextResponse.json(
      { success: true, conversationId, action: "archive" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("DELETE /api/ai/chat:", error);

    return errorResponse(
      action === "delete"
        ? "Unable to delete conversation."
        : "Unable to archive conversation.",
      500,
      CHAT_ERROR_CODES.INTERNAL_ERROR,
    );
  }
}

async function loadConversationPage(
  client: Prisma.TransactionClient | typeof prisma,
  conversationId: string,
  userId: string,
  beforeId: string | null,
  limit: number,
): Promise<ChatMessageRecord[]> {
  if (limit <= 0) return [];

  if (beforeId) {
    const beforeMessage = await client.aIMessage.findFirst({
      where: {
        id: beforeId,
        conversationId,
        userId,
      },
      select: {
        createdAt: true,
        id: true,
      },
    });

    if (!beforeMessage) return [];

    return loadMessagesBefore(
      client,
      conversationId,
      userId,
      beforeMessage,
      limit,
    );
  }

  return loadRecentMessages(client, conversationId, userId, limit);
}

async function loadConversationContext(
  client: Prisma.TransactionClient | typeof prisma,
  conversationId: string,
  userId: string,
  beforeMessageId: string | null,
  limit: number,
): Promise<ChatMessageRecord[]> {
  return loadConversationPage(
    client,
    conversationId,
    userId,
    beforeMessageId,
    limit,
  );
}

async function loadRecentMessages(
  tx: Prisma.TransactionClient | typeof prisma,
  conversationId: string,
  userId: string,
  limit: number,
): Promise<ChatMessageRecord[]> {
  const messages = await tx.aIMessage.findMany({
    where: {
      conversationId,
      userId,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      userId: true,
      generationId: true,
      videoGenerationId: true,
      parentMessageId: true,
      metadata: true,
      attachments: true,
    },
  });

  return messages.reverse();
}

async function loadMessagesBefore(
  tx: Prisma.TransactionClient | typeof prisma,
  conversationId: string,
  userId: string,
  before: Pick<ChatMessageRecord, "createdAt" | "id">,
  limit: number,
): Promise<ChatMessageRecord[]> {
  const messages = await tx.aIMessage.findMany({
    where: {
      conversationId,
      userId,
      OR: [
        {
          createdAt: {
            lt: before.createdAt,
          },
        },
        {
          createdAt: before.createdAt,
          id: {
            lt: before.id,
          },
        },
      ],
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      userId: true,
      generationId: true,
      videoGenerationId: true,
      parentMessageId: true,
      metadata: true,
      attachments: true,
    },
  });

  return messages.reverse();
}

function resolveStoredAttachmentsForContext(
  value: Prisma.JsonValue | null | undefined,
): StoredChatAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const attachment = item as Record<string, unknown>;

    if (
      typeof attachment.assetId !== "string" ||
      typeof attachment.name !== "string" ||
      typeof attachment.mimeType !== "string" ||
      typeof attachment.size !== "number" ||
      (attachment.kind !== "image" && attachment.kind !== "file") ||
      typeof attachment.openAIFileId !== "string"
    ) {
      return [];
    }

    return [
      {
        assetId: attachment.assetId,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        kind: normalizeStoredAttachmentKind(attachment.kind),
        openAIFileId: attachment.openAIFileId,
      },
    ];
  });
}

function buildBoundedAIContext(messages: ChatMessageRecord[]): AIChatMessage[] {
  const result: AIChatMessage[] = [];

  let characterCount = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== "USER" && message.role !== "ASSISTANT") {
      continue;
    }

    const nextLength = characterCount + message.content.length;

    if (result.length > 0 && nextLength > MAX_CONTEXT_CHARACTERS) {
      break;
    }

    const storedAttachments =
      message.role === "USER"
        ? resolveStoredAttachmentsForContext(message.attachments)
        : [];

    const aiMessage: AIChatMessage =
      message.role === "USER"
        ? {
            role: "user",
            content: buildAIMessageContent(message.content, storedAttachments),
          }
        : {
            role: "assistant",
            content: message.content,
          };

    result.unshift(aiMessage);

    characterCount = nextLength;

    if (result.length >= CONTEXT_MESSAGE_LIMIT) {
      break;
    }
  }

  return result;
}

function isPrismaUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function isInsufficientVideoCreditsError(
  error: unknown,
): error is Error & { required: number; available: number } {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    name?: unknown;
    required?: unknown;
    available?: unknown;
  };

  return (
    candidate.name === "InsufficientVideoCreditsError" &&
    typeof candidate.required === "number" &&
    typeof candidate.available === "number"
  );
}

function createConversationTitle(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();

  return normalized.length <= 50 ? normalized : `${normalized.slice(0, 47)}...`;
}
