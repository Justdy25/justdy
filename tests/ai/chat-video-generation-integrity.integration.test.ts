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
  reconcileStaleAIGenerations: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

vi.mock("@/lib/ai/generation/generate", () => ({
  reconcileStaleAIGenerations: mocks.reconcileStaleAIGenerations,
  streamAI: vi.fn(),
}));

vi.mock("@/lib/ai/orchestration/intent", () => ({
  detectAIIntent: vi.fn(),
}));

vi.mock("@/lib/ai/orchestration/worksheet-handler", () => ({
  generateWorksheetFromChat: vi.fn(),
}));

vi.mock("@/lib/ai/video/generator", () => ({
  generateVideo: vi.fn(),
}));

vi.mock("@/lib/ai/orchestration/image-handler", () => ({
  generateImageFromChat: vi.fn(),
}));

vi.mock("@/lib/ai/rate-limit", () => ({
  AIRateLimitError: class AIRateLimitError extends Error {},
  enforceAIRateLimit: vi.fn(),
  enforceAIConcurrencyLimit: vi.fn(),
}));

vi.mock("@/lib/ai/credits", () => ({
  getCreditBalance: vi.fn(),
  InsufficientAICreditsError: class InsufficientAICreditsError extends Error {},
}));

import { GET } from "@/app/api/ai/chat/route";
import prisma from "@/lib/prisma";

const testRunId = `chat-video-integrity-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}`;

const ownerId = `${testRunId}-owner`;
const foreignUserId = `${testRunId}-foreign`;

const ownerEmail = `${ownerId}@example.test`;
const foreignEmail = `${foreignUserId}@example.test`;

const ownerProjectId = `${testRunId}-owner-project`;
const secondOwnerProjectId = `${testRunId}-owner-project-2`;
const foreignProjectId = `${testRunId}-foreign-project`;

const projectConversationId = `${testRunId}-project-conversation`;
const globalConversationId = `${testRunId}-global-conversation`;

const ownerProjectVideoId = `${testRunId}-owner-project-video`;
const ownerSecondProjectVideoId = `${testRunId}-owner-second-project-video`;
const ownerGlobalVideoId = `${testRunId}-owner-global-video`;
const foreignVideoId = `${testRunId}-foreign-video`;

function createGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/ai/chat");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return new Request(url);
}

async function getConversationMessages(
  conversationId: string,
  projectId?: string,
) {
  const params: Record<string, string> = { conversationId };

  if (projectId) {
    params.projectId = projectId;
  }

  const response = await GET(createGetRequest(params));

  expect(response.status).toBe(200);

  const body = await response.json();

  return body.messages as Array<{
    id: string;
    role: string;
    videoGenerationId: string | null;
  }>;
}

describe("AI chat conversation-video-generation integrity", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          name: "Chat Video Integrity Owner",
          email: ownerEmail,
        },
        {
          id: foreignUserId,
          name: "Chat Video Integrity Foreign User",
          email: foreignEmail,
        },
      ],
    });

    await prisma.aIProject.createMany({
      data: [
        {
          id: ownerProjectId,
          userId: ownerId,
          name: "Owner Project One",
          type: "GENERAL",
          status: "ACTIVE",
        },
        {
          id: secondOwnerProjectId,
          userId: ownerId,
          name: "Owner Project Two",
          type: "GENERAL",
          status: "ACTIVE",
        },
        {
          id: foreignProjectId,
          userId: foreignUserId,
          name: "Foreign Project",
          type: "GENERAL",
          status: "ACTIVE",
        },
      ],
    });

    await prisma.aIConversation.createMany({
      data: [
        {
          id: projectConversationId,
          userId: ownerId,
          projectId: ownerProjectId,
          title: "Owner Project Conversation",
          status: "ACTIVE",
        },
        {
          id: globalConversationId,
          userId: ownerId,
          projectId: null,
          title: "Owner Global Conversation",
          status: "ACTIVE",
        },
      ],
    });

    await prisma.videoGeneration.createMany({
      data: [
        {
          id: ownerProjectVideoId,
          userId: ownerId,
          title: "Owner Project Video",
          prompt: "Owner project video.",
          duration: 5,
          aspectRatio: "16:9",
          provider: "test",
          status: "COMPLETED",
        },
        {
          id: ownerSecondProjectVideoId,
          userId: ownerId,
          title: "Owner Second Project Video",
          prompt: "Owner second project video.",
          duration: 5,
          aspectRatio: "16:9",
          provider: "test",
          status: "COMPLETED",
        },
        {
          id: ownerGlobalVideoId,
          userId: ownerId,
          title: "Owner Global Video",
          prompt: "Owner global video.",
          duration: 5,
          aspectRatio: "16:9",
          provider: "test",
          status: "COMPLETED",
        },
        {
          id: foreignVideoId,
          userId: foreignUserId,
          title: "Foreign User Video",
          prompt: "Private foreign user video.",
          duration: 5,
          aspectRatio: "16:9",
          provider: "test",
          status: "COMPLETED",
        },
      ],
    });

    await prisma.aIMessage.createMany({
      data: [
        {
          id: `${testRunId}-project-valid-message`,
          conversationId: projectConversationId,
          userId: ownerId,
          role: "ASSISTANT",
          content: "Valid owner project video.",
          videoGenerationId: ownerProjectVideoId,
        },
        {
          id: `${testRunId}-project-foreign-message`,
          conversationId: projectConversationId,
          userId: ownerId,
          role: "ASSISTANT",
          content: "Foreign video reference.",
          videoGenerationId: foreignVideoId,
        },
        {
          id: `${testRunId}-project-null-message`,
          conversationId: projectConversationId,
          userId: ownerId,
          role: "ASSISTANT",
          content: "Message without a video reference.",
          videoGenerationId: null,
        },
        {
          id: `${testRunId}-global-valid-message`,
          conversationId: globalConversationId,
          userId: ownerId,
          role: "ASSISTANT",
          content: "Valid owner global video.",
          videoGenerationId: ownerGlobalVideoId,
        },
      ],
    });
  });

  beforeEach(() => {
    mocks.getAuthenticatedUser.mockResolvedValue({
      id: ownerId,
      name: "Chat Video Integrity Owner",
      email: ownerEmail,
    });
  });

  afterAll(async () => {
    await prisma.aIMessage.deleteMany({
      where: {
        id: { startsWith: testRunId },
      },
    });

    await prisma.videoGeneration.deleteMany({
      where: {
        id: { startsWith: testRunId },
      },
    });

    await prisma.aIConversation.deleteMany({
      where: {
        id: { startsWith: testRunId },
      },
    });

    await prisma.aIProject.deleteMany({
      where: {
        id: { startsWith: testRunId },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { startsWith: testRunId },
      },
    });
  });

  it("returns a video generation linked to the authenticated user's conversation", async () => {
    const messages = await getConversationMessages(
      projectConversationId,
      ownerProjectId,
    );

    const returned = messages.find(
      (message) => message.id === `${testRunId}-project-valid-message`,
    );

    expect(returned).toBeDefined();
    expect(returned?.videoGenerationId).toBe(ownerProjectVideoId);
  });

  it("must not expose another user's video generation through a conversation", async () => {
    const messages = await getConversationMessages(
      projectConversationId,
      ownerProjectId,
    );

    const returned = messages.find(
      (message) => message.id === `${testRunId}-project-foreign-message`,
    );

    expect(returned).toBeDefined();
    expect(returned?.videoGenerationId).toBeNull();
  });

  it("preserves a null video-generation reference", async () => {
    const messages = await getConversationMessages(
      projectConversationId,
      ownerProjectId,
    );

    const returned = messages.find(
      (message) => message.id === `${testRunId}-project-null-message`,
    );

    expect(returned).toBeDefined();
    expect(returned?.videoGenerationId).toBeNull();
  });

  it("allows the authenticated user's video generation in a global conversation", async () => {
    const messages = await getConversationMessages(globalConversationId);

    const returned = messages.find(
      (message) => message.id === `${testRunId}-global-valid-message`,
    );

    expect(returned).toBeDefined();
    expect(returned?.videoGenerationId).toBe(ownerGlobalVideoId);
  });

  it("does not claim project isolation for video generations because VideoGeneration has no projectId", async () => {
    const messageId = `${testRunId}-project-cross-project-message`;

    await prisma.aIMessage.create({
      data: {
        id: messageId,
        conversationId: projectConversationId,
        userId: ownerId,
        role: "ASSISTANT",
        content: "Same user's video from another project.",
        videoGenerationId: ownerSecondProjectVideoId,
      },
    });

    const messages = await getConversationMessages(
      projectConversationId,
      ownerProjectId,
    );

    const returned = messages.find((message) => message.id === messageId);

    expect(returned).toBeDefined();

    // VideoGeneration currently has no projectId, so the API can enforce
    // user ownership but cannot distinguish Project A from Project B.
    expect(returned?.videoGenerationId).toBe(ownerSecondProjectVideoId);
  });
});
