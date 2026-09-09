import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  detectAIIntent: vi.fn(),
  generateWorksheetFromChat: vi.fn(),
  reconcileStaleAIGenerations: vi.fn(),
  generateVideo: vi.fn(),
  generateImageFromChat: vi.fn(),
  enforceAIRateLimit: vi.fn(),
  enforceAIConcurrencyLimit: vi.fn(),
  getCreditBalance: vi.fn(),
}));

/**
 * ============================================================
 * ROUTE DEPENDENCY BOUNDARIES
 * ============================================================
 *
 * This is a worksheet-route integration test.
 *
 * The production route imports image/video/text-generation
 * dependencies, but this test must not execute those providers.
 * They are replaced at the module boundary.
 */

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

vi.mock("@/lib/ai/orchestration/intent", () => ({
  detectAIIntent: mocks.detectAIIntent,
}));

vi.mock("@/lib/ai/orchestration/worksheet-handler", () => ({
  generateWorksheetFromChat: mocks.generateWorksheetFromChat,
}));

vi.mock("@/lib/ai/video/generator", () => ({
  generateVideo: mocks.generateVideo,
}));

vi.mock("@/lib/ai/orchestration/image-handler", () => ({
  generateImageFromChat: mocks.generateImageFromChat,
}));

vi.mock("@/lib/ai/generation/generate", () => ({
  reconcileStaleAIGenerations: mocks.reconcileStaleAIGenerations,

  streamAI: vi.fn(),
}));

vi.mock("@/lib/ai/rate-limit", () => ({
  AIRateLimitError: class AIRateLimitError extends Error {},

  enforceAIRateLimit: mocks.enforceAIRateLimit,

  enforceAIConcurrencyLimit: mocks.enforceAIConcurrencyLimit,
}));

vi.mock("@/lib/ai/credits", () => ({
  getCreditBalance: mocks.getCreditBalance,

  InsufficientAICreditsError: class InsufficientAICreditsError extends Error {},
}));

import { POST } from "@/app/api/ai/chat/route";

import prisma from "@/lib/prisma";

import {
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";

/**
 * ============================================================
 * TEST FIXTURE
 * ============================================================
 */

const testUserId = `worksheet-route-user-${Date.now()}`;
const testUserEmail = `${testUserId}@example.test`;

let testUserCreated = false;

/**
 * ============================================================
 * FIXED WORKSHEET FIXTURE
 * ============================================================
 *
 * The real OpenAI call is mocked.
 *
 * The purpose of this test is to verify the production chat
 * route lifecycle, not OpenAI itself.
 */

const worksheet = {
  gradeLevel: "Grade 1",
  subject: "Mathematics",
  topic: "Counting to 10",
  title: "Counting to 10",
  learningObjective: "Students will count and identify numbers from 1 to 10.",
  questions: [
    {
      id: "q1",
      number: 1,
      type: "multiple_choice" as const,
      question: "What number comes after 3?",
      options: [
        { id: "a", text: "2" },
        { id: "b", text: "4" },
        { id: "c", text: "5" },
        { id: "d", text: "6" },
      ],
      answer: "4",
      explanation: "The number after 3 is 4.",
      points: 1,
    },
    {
      id: "q2",
      number: 2,
      type: "short_answer" as const,
      question: "Count from 1 to 5.",
      options: null,
      answer: "1, 2, 3, 4, 5",
      explanation: "These are the numbers from 1 through 5.",
      points: 1,
    },
  ],
  answerKey: [
    {
      number: 1,
      answer: "4",
    },
    {
      number: 2,
      answer: "1, 2, 3, 4, 5",
    },
  ],
  totalPoints: 2,
};

const command = {
  gradeLevel: "Grade 1",
  subject: "Mathematics",
  topic: "Counting to 10",
  title: "Counting to 10",
  learningObjective: "Students will count and identify numbers from 1 to 10.",
  questionCount: 2,
  difficulty: "easy",
  questionTypes: ["multiple_choice", "short_answer"],
  instructions: null,
};

/**
 * ============================================================
 * REQUEST HELPERS
 * ============================================================
 */

function createRequest({
  requestId,
  conversationId = null,
  message = "Create a Grade 1 mathematics worksheet about counting to 10.",
}: {
  requestId: string;
  conversationId?: string | null;
  message?: string;
}) {
  return new Request("http://localhost:3000/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      action: "send",
      conversationId,
      message,
      requestId,
    }),
  });
}

async function readSSE(response: Response) {
  const text = await response.text();

  const events = text
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const dataLine = block
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (!dataLine) {
        throw new Error(`Invalid SSE block: ${block}`);
      }

      return JSON.parse(dataLine.slice("data: ".length));
    });

  return {
    raw: text,
    events,
    start: events.find((event) => event.type === "start"),
    done: events.find((event) => event.type === "done"),
    error: events.find((event) => event.type === "error"),
  };
}

/**
 * ============================================================
 * TEST SUITE
 * ============================================================
 */

describe("Worksheet /api/ai/chat route integration", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Worksheet Route Integration Test",
        email: testUserEmail,
      },
    });

    testUserCreated = true;
  });

  beforeEach(async () => {
    /**
     * Remove test data in dependency-safe order.
     */

    await prisma.aIMessage.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.aIGeneration.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.aIConversation.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    mocks.getAuthenticatedUser.mockResolvedValue({
      id: testUserId,
      name: "Worksheet Route Integration Test",
      email: testUserEmail,
    });

    mocks.detectAIIntent.mockReturnValue({
      intent: "WORKSHEET",
      confidence: 1,
    });

    mocks.reconcileStaleAIGenerations.mockResolvedValue(undefined);

    mocks.generateWorksheetFromChat.mockResolvedValue({
      worksheet,
      command,
    });
  });

  afterAll(async () => {
    await prisma.aIMessage.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.aIGeneration.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.aIConversation.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    if (testUserCreated) {
      await prisma.user.deleteMany({
        where: {
          id: testUserId,
        },
      });
    }

    await prisma.$disconnect();
  });

  /**
   * ==========================================================
   * TEST 1 — AUTHENTICATION
   * ==========================================================
   */

  it("rejects unauthenticated worksheet requests", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const requestId = `worksheet-route-auth-${Date.now()}-${Math.random()}`;

    const response = await POST(
      createRequest({
        requestId,
      }),
    );

    expect(response.status).toBe(401);

    const body = await response.json();

    expect(body.error).toBe("Authentication required");

    /**
     * Authentication must fail before any worksheet generation
     * or database generation record is created.
     */

    expect(mocks.generateWorksheetFromChat).not.toHaveBeenCalled();

    const generations = await prisma.aIGeneration.findMany({
      where: {
        requestId,
      },
    });

    expect(generations).toHaveLength(0);
  });

  /**
   * ==========================================================
   * TEST 2 — SUCCESSFUL WORKSHEET REQUEST
   * ==========================================================
   */

  it("completes a worksheet request through the production route", async () => {
    const requestId = `worksheet-route-success-${Date.now()}-${Math.random()}`;

    const response = await POST(
      createRequest({
        requestId,
      }),
    );

    /**
     * The specialized worksheet route returns an SSE response.
     */

    expect(response.status).toBe(200);

    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const { events, start, done } = await readSSE(response);

    /**
     * Exactly start + done are expected.
     */

    expect(events).toHaveLength(2);

    expect(start).toBeDefined();
    expect(done).toBeDefined();

    /**
     * ----------------------------------------------------------
     * START EVENT
     * ----------------------------------------------------------
     */

    expect(start.type).toBe("start");

    expect(start.action).toBe("send");

    expect(start.generation.type).toBe("WORKSHEET");

    expect(start.generation.status).toBe("PROCESSING");

    expect(start.generation.id).toBeTruthy();

    expect(start.userMessage.id).toBeTruthy();

    expect(start.userMessage.role).toBe("USER");

    expect(start.userMessage.content).toContain("Grade 1");

    /**
     * ----------------------------------------------------------
     * DONE EVENT
     * ----------------------------------------------------------
     */

    expect(done.type).toBe("done");

    expect(done.action).toBe("send");

    expect(done.generation.type).toBe("WORKSHEET");

    expect(done.generation.status).toBe("COMPLETED");

    expect(done.generation.id).toBe(start.generation.id);

    expect(done.requestId).toBe(requestId);

    expect(done.worksheet.title).toBe(worksheet.title);

    expect(done.worksheet.questions).toHaveLength(2);

    expect(done.assistantMessage).toBeDefined();

    expect(done.assistantMessage.role).toBe("ASSISTANT");

    expect(done.assistantMessage.content).toBe(
      `Your worksheet "${worksheet.title}" is ready.`,
    );

    /**
     * ----------------------------------------------------------
     * DATABASE — AIGeneration
     * ----------------------------------------------------------
     */

    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId,
        type: AIGenerationType.WORKSHEET,
      },
      select: {
        id: true,
        userId: true,
        requestId: true,
        type: true,
        status: true,
        prompt: true,
        outputData: true,
        provider: true,
        model: true,
        completedAt: true,
      },
    });

    /**
     * Exactly ONE generation must exist.
     */

    expect(generations).toHaveLength(1);

    const generation = generations[0];

    expect(generation.userId).toBe(testUserId);

    expect(generation.requestId).toBe(requestId);

    expect(generation.type).toBe(AIGenerationType.WORKSHEET);

    expect(generation.status).toBe(AIGenerationStatus.COMPLETED);

    expect(generation.provider).toBe("openai");

    expect(generation.model).toBe("gpt-5");

    expect(generation.completedAt).not.toBeNull();

    expect(generation.prompt).toContain("Grade 1");

    /**
     * The generated worksheet must be durably stored in
     * AIGeneration.outputData.
     */

    expect(generation.outputData).toBeTruthy();

    const outputData = generation.outputData as {
      worksheet?: {
        title?: string;
        questions?: unknown[];
      };
      command?: {
        gradeLevel?: string;
      };
    };

    expect(outputData.worksheet?.title).toBe(worksheet.title);

    expect(outputData.worksheet?.questions).toHaveLength(2);

    expect(outputData.command?.gradeLevel).toBe("Grade 1");

    /**
     * ----------------------------------------------------------
     * DATABASE — ASSISTANT MESSAGE
     * ----------------------------------------------------------
     */

    const assistantMessages = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        role: "ASSISTANT",
      },
      select: {
        id: true,
        conversationId: true,
        role: true,
        content: true,
        generationId: true,
        parentMessageId: true,
        metadata: true,
      },
    });

    expect(assistantMessages).toHaveLength(1);

    const assistant = assistantMessages[0];

    expect(assistant.role).toBe("ASSISTANT");

    expect(assistant.generationId).toBe(generation.id);

    expect(assistant.content).toBe(
      `Your worksheet "${worksheet.title}" is ready.`,
    );

    expect(assistant.parentMessageId).toBe(done.userMessage.id);

    const metadata = assistant.metadata as {
      type?: string;
      requestId?: string;
      worksheet?: {
        title?: string;
      };
    };

    expect(metadata.type).toBe("WORKSHEET");

    expect(metadata.requestId).toBe(requestId);

    expect(metadata.worksheet?.title).toBe(worksheet.title);

    /**
     * ----------------------------------------------------------
     * DATABASE — CONVERSATION
     * ----------------------------------------------------------
     */

    const conversation = await prisma.aIConversation.findUnique({
      where: {
        id: done.conversationId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        activeMessageId: true,
      },
    });

    expect(conversation).not.toBeNull();

    expect(conversation?.userId).toBe(testUserId);

    expect(conversation?.status).toBe("ACTIVE");

    expect(conversation?.activeMessageId).toBe(assistant.id);
  });

  /**
   * ==========================================================
   * TEST 3 — COMPLETED REPLAY
   * ==========================================================
   */

  it("returns 409 and does not regenerate a completed worksheet request", async () => {
    const requestId = `worksheet-route-replay-${Date.now()}-${Math.random()}`;

    /**
     * First request.
     */

    const firstResponse = await POST(
      createRequest({
        requestId,
      }),
    );

    expect(firstResponse.status).toBe(200);

    const firstSSE = await readSSE(firstResponse);

    expect(firstSSE.done).toBeDefined();

    const generationId = firstSSE.done.generation.id;

    const assistantId = firstSSE.done.assistantMessage.id;

    /**
     * Reset the mock call count so we can prove that the replay
     * never reaches worksheet generation.
     */

    mocks.generateWorksheetFromChat.mockClear();

    /**
     * Second request with the EXACT SAME requestId.
     */

    const replayResponse = await POST(
      createRequest({
        requestId,
      }),
    );

    expect(replayResponse.status).toBe(409);

    const replayBody = await replayResponse.json();

    expect(replayBody.code).toBe("DUPLICATE_GENERATION_REQUEST");

    expect(replayBody.generationId).toBe(generationId);

    expect(replayBody.status).toBe(AIGenerationStatus.COMPLETED);

    expect(replayBody.type).toBe("WORKSHEET");

    /**
     * The OpenAI worksheet generator must NOT run again.
     */

    expect(mocks.generateWorksheetFromChat).not.toHaveBeenCalled();

    /**
     * Exactly one generation remains.
     */

    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId,
      },
    });

    expect(generations).toHaveLength(1);

    expect(generations[0].id).toBe(generationId);

    expect(generations[0].status).toBe(AIGenerationStatus.COMPLETED);

    /**
     * Exactly one assistant remains.
     */

    const assistants = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        role: "ASSISTANT",
      },
    });

    const matchingAssistants = assistants.filter((message) => {
      const metadata = message.metadata;

      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
      ) {
        return false;
      }

      return (
        (
          metadata as {
            requestId?: unknown;
          }
        ).requestId === requestId
      );
    });

    expect(matchingAssistants).toHaveLength(1);

    expect(matchingAssistants[0].id).toBe(assistantId);
  });

  /**
   * ==========================================================
   * TEST 4 — FAILED REQUEST REPLAY
   * ==========================================================
   */

  it("marks a failed worksheet request FAILED and rejects its replay", async () => {
    const requestId = `worksheet-route-failed-${Date.now()}-${Math.random()}`;

    const generationError = new Error("Simulated worksheet provider failure.");

    mocks.generateWorksheetFromChat.mockRejectedValueOnce(generationError);

    /**
     * First request must fail.
     */

    const firstResponse = await POST(
      createRequest({
        requestId,
      }),
    );

    expect(firstResponse.status).toBe(500);

    const firstBody = await firstResponse.json();

    expect(firstBody.code).toBe("INTERNAL_ERROR");

    /**
     * The generation must have been durably settled as FAILED.
     */

    const failedGeneration = await prisma.aIGeneration.findUnique({
      where: {
        requestId,
      },
      select: {
        id: true,
        userId: true,
        requestId: true,
        type: true,
        status: true,
        errorMessage: true,
        completedAt: true,
      },
    });

    expect(failedGeneration).not.toBeNull();

    expect(failedGeneration?.userId).toBe(testUserId);

    expect(failedGeneration?.requestId).toBe(requestId);

    expect(failedGeneration?.type).toBe(AIGenerationType.WORKSHEET);

    expect(failedGeneration?.status).toBe(AIGenerationStatus.FAILED);

    expect(failedGeneration?.errorMessage).toBe(
      "Simulated worksheet provider failure.",
    );

    expect(failedGeneration?.completedAt).not.toBeNull();

    /**
     * The first request should have created no assistant
     * response because worksheet generation failed.
     */

    const assistantsBeforeReplay = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        role: "ASSISTANT",
      },
    });

    const matchingBeforeReplay = assistantsBeforeReplay.filter((message) => {
      const metadata = message.metadata;

      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
      ) {
        return false;
      }

      return (
        (
          metadata as {
            requestId?: unknown;
          }
        ).requestId === requestId
      );
    });

    expect(matchingBeforeReplay).toHaveLength(0);

    /**
     * Prevent the test from accidentally succeeding by invoking
     * the mocked worksheet generator on replay.
     */

    mocks.generateWorksheetFromChat.mockClear();

    /**
     * Replay the SAME requestId.
     */

    const replayResponse = await POST(
      createRequest({
        requestId,
      }),
    );

    expect(replayResponse.status).toBe(409);

    const replayBody = await replayResponse.json();

    expect(replayBody.code).toBe("DUPLICATE_GENERATION_REQUEST");

    expect(replayBody.generationId).toBe(failedGeneration?.id);

    expect(replayBody.status).toBe(AIGenerationStatus.FAILED);

    expect(replayBody.type).toBe("WORKSHEET");

    /**
     * No second worksheet generation.
     */

    expect(mocks.generateWorksheetFromChat).not.toHaveBeenCalled();

    /**
     * Still exactly one generation.
     */

    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId,
      },
    });

    expect(generations).toHaveLength(1);

    expect(generations[0].id).toBe(failedGeneration?.id);

    expect(generations[0].status).toBe(AIGenerationStatus.FAILED);
  });

  /**
   * ==========================================================
   * TEST 5 — TRUE CONCURRENT SAME-requestId ROUTE RACE
   * ==========================================================
   */

  it("allows exactly one concurrent worksheet request to claim a requestId", async () => {
    const requestId = `worksheet-route-concurrent-${Date.now()}-${Math.random()}`;

    /**
     * Keep generation deterministic and fast.
     */

    mocks.generateWorksheetFromChat.mockImplementation(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      return {
        worksheet,
        command,
      };
    });

    /**
     * Send TWO actual POST route calls concurrently with the
     * SAME requestId.
     */

    const [responseA, responseB] = await Promise.all([
      POST(
        createRequest({
          requestId,
          message:
            "Create a Grade 1 mathematics worksheet about counting to 10.",
        }),
      ),
      POST(
        createRequest({
          requestId,
          message:
            "Create a Grade 1 mathematics worksheet about counting to 10.",
        }),
      ),
    ]);

    const statuses = [responseA.status, responseB.status].sort();

    /**
     * One request must succeed.
     * The other must be rejected as a duplicate.
     */

    expect(statuses).toEqual([200, 409]);

    /**
     * Read whichever response succeeded.
     */

    const successfulResponse = responseA.status === 200 ? responseA : responseB;

    const duplicateResponse = responseA.status === 409 ? responseA : responseB;

    const successfulSSE = await readSSE(successfulResponse);

    const duplicateBody = await duplicateResponse.json();

    expect(successfulSSE.done).toBeDefined();

    expect(successfulSSE.done.generation.status).toBe("COMPLETED");

    expect(successfulSSE.done.requestId).toBe(requestId);

    expect(duplicateBody.code).toBe("DUPLICATE_GENERATION_REQUEST");

    expect(duplicateBody.type).toBe("WORKSHEET");

    /**
     * The duplicate must point to the same durable generation
     * that completed the request.
     */

    expect(duplicateBody.generationId).toBe(successfulSSE.done.generation.id);

    /**
     * ----------------------------------------------------------
     * DATABASE INVARIANTS
     * ----------------------------------------------------------
     */

    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
        requestId,
      },
      select: {
        id: true,
        userId: true,
        requestId: true,
        type: true,
        status: true,
      },
    });

    /**
     * CRITICAL:
     *
     * There can be only ONE durable generation for the
     * requestId.
     */

    expect(generations).toHaveLength(1);

    expect(generations[0].id).toBe(successfulSSE.done.generation.id);

    expect(generations[0].userId).toBe(testUserId);

    expect(generations[0].requestId).toBe(requestId);

    expect(generations[0].type).toBe(AIGenerationType.WORKSHEET);

    expect(generations[0].status).toBe(AIGenerationStatus.COMPLETED);

    /**
     * Exactly ONE worksheet assistant response must exist.
     */

    const assistants = await prisma.aIMessage.findMany({
      where: {
        userId: testUserId,
        role: "ASSISTANT",
      },
      select: {
        id: true,
        conversationId: true,
        generationId: true,
        metadata: true,
      },
    });

    const matchingAssistants = assistants.filter((message) => {
      const metadata = message.metadata;

      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
      ) {
        return false;
      }

      return (
        (
          metadata as {
            requestId?: unknown;
          }
        ).requestId === requestId
      );
    });

    expect(matchingAssistants).toHaveLength(1);

    expect(matchingAssistants[0].generationId).toBe(generations[0].id);

    /**
     * The assistant must belong to the successful request's
     * conversation.
     */

    expect(matchingAssistants[0].conversationId).toBe(
      successfulSSE.done.conversationId,
    );
  });
});
