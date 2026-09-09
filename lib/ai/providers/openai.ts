import OpenAI from "openai";

import type {
  AIProvider,
  AIProviderCapabilities,
  AIProviderGenerateOptions,
  AIProviderStreamEvent,
  AIProviderStreamOptions,
} from "@/lib/ai/providers/types";
import { AIError } from "@/lib/ai/errors";
import type { AIChatMessage, AIChatResponse } from "@/lib/ai/types";
import { createProviderError } from "@/lib/ai/providers/errors";
import { getRequiredOpenAIAPIKey } from "@/lib/ai/config";
import { logAIError, logAIInfo } from "@/lib/ai/logger";
import { createAITimer, createAITTFTTimer } from "@/lib/ai/timing";

const openai = new OpenAI({
  apiKey: getRequiredOpenAIAPIKey(),
});

const DEFAULT_MODEL = "gpt-5-mini";

const JUSTDY_SYSTEM_INSTRUCTIONS = `
You are Justdy AI, a helpful general-purpose AI assistant.

Justdy is a general AI platform that helps people create, learn,
research, analyze information, and get things done.

Be accurate, useful, clear, and appropriately concise.

Adapt your response to the user's goal and level of understanding.

When explaining complex subjects, structure the answer clearly.

Do not claim to have performed actions, accessed information, or used tools
that you did not actually perform or use.

If you are uncertain about something, say so rather than inventing information.
`.trim();

type OpenAIResponseInput = NonNullable<
  Parameters<typeof openai.responses.create>[0]["input"]
>;

type OpenAIResponse = Extract<
  Awaited<ReturnType<typeof openai.responses.create>>,
  { output_text: string }
>;

type OpenAIResponseStream = Extract<
  Awaited<ReturnType<typeof openai.responses.create>>,
  AsyncIterable<unknown>
>;

/**
 * Convert Justdy's internal AIChatMessage format into the
 * Responses API input-item format.
 *
 * Internal format:
 *
 * {
 *   role: "user" | "assistant" | "system",
 *   content: string
 * }
 *
 * Responses API format:
 *
 * {
 *   role: "user" | "assistant" | "system",
 *   content: [
 *     {
 *       type: "input_text",
 *       text: "..."
 *     }
 *   ]
 * }
 *
 * The explicit conversion is important. A TypeScript cast does
 * not transform the runtime value.
 */
function toOpenAIInput(messages: AIChatMessage[]): OpenAIResponseInput {
  return messages.map((message) => ({
    role: message.role,
    content: [
      {
        type: "input_text",
        text: message.content,
      },
    ],
  })) as OpenAIResponseInput;
}

function getModel(model?: string): string {
  const selectedModel = model?.trim() || DEFAULT_MODEL;

  const supportedModel = capabilities.models.find(
    (item) => item.id === selectedModel,
  );

  if (!supportedModel) {
    throw new Error(
      `OpenAI model "${selectedModel}" is not supported by Justdy AI.`,
    );
  }

  return supportedModel.id;
}

function normalizeStreamEvent(event: unknown): AIProviderStreamEvent {
  if (!event || typeof event !== "object") {
    return {
      type: "unknown",
    };
  }

  const candidate = event as {
    type?: unknown;
    delta?: unknown;
  };

  return {
    type: typeof candidate.type === "string" ? candidate.type : "unknown",
    delta: typeof candidate.delta === "string" ? candidate.delta : undefined,
  };
}

async function generate(
  messages: AIChatMessage[],
  options?: AIProviderGenerateOptions,
): Promise<AIChatResponse> {
  const model = getModel(options?.model);
  const timer = createAITimer();

  logAIInfo("provider.started", {
    operation: "CHAT",
    provider: "openai",
    model,
  });

  let response: OpenAIResponse;

  try {
    response = (await openai.responses.create(
      {
        model,
        instructions: JUSTDY_SYSTEM_INSTRUCTIONS,
        input: toOpenAIInput(messages),
      },
      {
        signal: options?.signal,
      },
    )) as OpenAIResponse;
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }

    logAIError("provider.failed", {
      operation: "CHAT",
      provider: "openai",
      model,
      durationMs: timer.elapsedMs(),
    });

    throw createProviderError({
      provider: "openai",
      operation: "CHAT",
      model,
      error,
    });
  }

  const text = response.output_text?.trim();

  if (!text) {
    logAIError("provider.failed", {
      operation: "CHAT",
      provider: "openai",
      model,
      durationMs: timer.elapsedMs(),
      errorCode: "EMPTY_RESPONSE",
    });

    throw new AIError(
      "EMPTY_RESPONSE",
      "AI provider returned an empty response.",
      {
        details: {
          provider: "openai",
          operation: "CHAT",
          model,
        },
      },
    );
  }

  logAIInfo("provider.completed", {
    operation: "CHAT",
    provider: "openai",
    model,
    durationMs: timer.elapsedMs(),
    outputLength: text.length,
  });

  return {
    text,
    provider: "openai",
    model,
  };
}

async function stream(
  messages: AIChatMessage[],
  options?: AIProviderStreamOptions,
) {
  const model = getModel(options?.model);
  const timer = createAITimer();
  const ttftTimer = createAITTFTTimer();

  logAIInfo("provider.started", {
    operation: "CHAT",
    provider: "openai",
    model,
  });

  let response: OpenAIResponseStream;

  try {
    response = (await openai.responses.create(
      {
        model,
        instructions: JUSTDY_SYSTEM_INSTRUCTIONS,
        input: toOpenAIInput(messages),
        stream: true,
      },
      {
        signal: options?.signal,
      },
    )) as OpenAIResponseStream;
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }

    logAIError("provider.failed", {
      operation: "CHAT",
      provider: "openai",
      model,
      durationMs: timer.elapsedMs(),
    });

    throw createProviderError({
      provider: "openai",
      operation: "CHAT",
      model,
      error,
    });
  }

  async function* loggedStream(): AsyncIterable<AIProviderStreamEvent> {
    let outputLength = 0;

    try {
      for await (const rawEvent of response) {
        const event = normalizeStreamEvent(rawEvent);

        if (
          event.type === "response.output_text.delta" &&
          typeof event.delta === "string" &&
          event.delta.length > 0
        ) {
          ttftTimer.markFirstToken();

          outputLength += event.delta.length;
        }

        yield event;
      }

      logAIInfo("provider.completed", {
        operation: "CHAT",
        provider: "openai",
        model,
        durationMs: timer.elapsedMs(),
        outputLength,
      });
    } catch (error) {
      if (options?.signal?.aborted) {
        return;
      }

      logAIError("provider.failed", {
        operation: "CHAT",
        provider: "openai",
        model,
        durationMs: timer.elapsedMs(),
      });

      throw createProviderError({
        provider: "openai",
        operation: "CHAT",
        model,
        error,
      });
    }
  }

  return {
    stream: loggedStream(),
    provider: "openai" as const,
    model,
  };
}

const capabilities: AIProviderCapabilities = {
  operations: ["CHAT"],
  models: [
    {
      id: DEFAULT_MODEL,
      operations: ["CHAT"],
      default: true,
    },
  ],
};

export const openAIProvider: AIProvider = {
  name: "openai",
  capabilities,
  generate,
  stream,
};

export async function generateOpenAIChatResponse(
  messages: AIChatMessage[],
): Promise<AIChatResponse> {
  return openAIProvider.generate(messages);
}

export async function streamOpenAIChatResponse(
  messages: AIChatMessage[],
  options?: {
    signal?: AbortSignal;
  },
) {
  return openAIProvider.stream(messages, options);
}
