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
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

import { GET } from "@/app/api/ai/chat/route";
import prisma from "@/lib/prisma";
import {
  AIGenerationStatus,
  AIGenerationType,
  AIProjectStatus,
  AIProjectType,
} from "@/lib/generated/prisma/enums";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ownerId = `phase5g-generation-owner-${suffix}`;
const foreignUserId = `phase5g-generation-foreign-${suffix}`;

const ownerEmail = `${ownerId}@example.test`;
const foreignEmail = `${foreignUserId}@example.test`;

const ownerProjectAId = `phase5g-generation-project-a-${suffix}`;
const ownerProjectBId = `phase5g-generation-project-b-${suffix}`;
const foreignProjectId = `phase5g-generation-foreign-project-${suffix}`;

const projectConversationId = `phase5g-generation-project-conversation-${suffix}`;
const secondProjectConversationId = `phase5g-generation-second-conversation-${suffix}`;
const globalConversationId = `phase5g-generation-global-conversation-${suffix}`;

let ownerCreated = false;
let foreignUserCreated = false;

function createGetRequest(conversationId: string) {
  const url = new URL("http://localhost:3000/api/ai/chat");

  url.searchParams.set("conversationId", conversationId);

  return new Request(url);
}

describe("AI chat conversation-generation integrity", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          name: "Phase 5G Generation Owner",
          email: ownerEmail,
        },
        {
          id: foreignUserId,
          name: "Phase 5G Generation Foreign User",
          email: foreignEmail,
        },
      ],
    });

    ownerCreated = true;
    foreignUserCreated = true;

    await prisma.aIProject.createMany({
      data: [
        {
          id: ownerProjectAId,
          userId: ownerId,
          name: "Generation Project A",
          type: AIProjectType.GENERAL,
          status: AIProjectStatus.ACTIVE,
        },
        {
          id: ownerProjectBId,
          userId: ownerId,
          name: "Generation Project B",
          type: AIProjectType.GENERAL,
          status: AIProjectStatus.ACTIVE,
        },
        {
          id: foreignProjectId,
          userId: foreignUserId,
          name: "Foreign Generation Project",
          type: AIProjectType.GENERAL,
          status: AIProjectStatus.ACTIVE,
        },
      ],
    });

    await prisma.aIConversation.createMany({
      data: [
        {
          id: projectConversationId,
          userId: ownerId,
          projectId: ownerProjectAId,
          title: "Project A Conversation",
          status: "ACTIVE",
        },
        {
          id: secondProjectConversationId,
          userId: ownerId,
          projectId: ownerProjectBId,
          title: "Project B Conversation",
          status: "ACTIVE",
        },
        {
          id: globalConversationId,
          userId: ownerId,
          projectId: null,
          title: "Global Conversation",
          status: "ACTIVE",
        },
      ],
    });
  });

  beforeEach(async () => {
    await prisma.aIMessage.deleteMany({
      where: {
        userId: {
          in: [ownerId, foreignUserId],
        },
      },
    });

    await prisma.aIGeneration.deleteMany({
      where: {
        userId: {
          in: [ownerId, foreignUserId],
        },
      },
    });

    mocks.getAuthenticatedUser.mockResolvedValue({
      id: ownerId,
      name: "Phase 5G Generation Owner",
      email: ownerEmail,
    });
  });

  afterAll(async () => {
    await prisma.aIMessage.deleteMany({
      where: {
        userId: {
          in: [ownerId, foreignUserId],
        },
      },
    });

    await prisma.aIGeneration.deleteMany({
      where: {
        userId: {
          in: [ownerId, foreignUserId],
        },
      },
    });

    await prisma.aIConversation.deleteMany({
      where: {
        userId: {
          in: [ownerId, foreignUserId],
        },
      },
    });

    await prisma.aIProject.deleteMany({
      where: {
        userId: {
          in: [ownerId, foreignUserId],
        },
      },
    });

    if (ownerCreated) {
      await prisma.user.deleteMany({
        where: {
          id: ownerId,
        },
      });
    }

    if (foreignUserCreated) {
      await prisma.user.deleteMany({
        where: {
          id: foreignUserId,
        },
      });
    }

    await prisma.$disconnect();
  });

  it("returns a generation linked to the same user's conversation", async () => {
    const generation = await prisma.aIGeneration.create({
      data: {
        userId: ownerId,
        projectId: ownerProjectAId,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "Create a mathematics explanation.",
        creditsUsed: 0,
      },
    });

    const userMessage = await prisma.aIMessage.create({
      data: {
        conversationId: projectConversationId,
        userId: ownerId,
        role: "USER",
        content: "Create a mathematics explanation.",
      },
    });

    const assistantMessage = await prisma.aIMessage.create({
      data: {
        conversationId: projectConversationId,
        userId: ownerId,
        role: "ASSISTANT",
        content: "Here is your mathematics explanation.",
        parentMessageId: userMessage.id,
        generationId: generation.id,
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: projectConversationId,
      },
      data: {
        activeMessageId: assistantMessage.id,
      },
    });

    const response = await GET(createGetRequest(projectConversationId));

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.messages).toHaveLength(2);

    const returnedAssistant = body.messages.find(
      (message: { id: string }) => message.id === assistantMessage.id,
    );

    expect(returnedAssistant).toBeDefined();
    expect(returnedAssistant.generationId).toBe(generation.id);
  });

  it("must not expose a generation from another project through a project-scoped conversation", async () => {
    const generation = await prisma.aIGeneration.create({
      data: {
        userId: ownerId,
        projectId: ownerProjectBId,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "Generation belongs to Project B.",
        creditsUsed: 0,
      },
    });

    const userMessage = await prisma.aIMessage.create({
      data: {
        conversationId: projectConversationId,
        userId: ownerId,
        role: "USER",
        content: "Project A request.",
      },
    });

    const assistantMessage = await prisma.aIMessage.create({
      data: {
        conversationId: projectConversationId,
        userId: ownerId,
        role: "ASSISTANT",
        content: "Invalid cross-project generation.",
        parentMessageId: userMessage.id,
        generationId: generation.id,
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: projectConversationId,
      },
      data: {
        activeMessageId: assistantMessage.id,
      },
    });

    const response = await GET(createGetRequest(projectConversationId));

    expect(response.status).toBe(200);

    const body = await response.json();

    const returnedAssistant = body.messages.find(
      (message: { id: string }) => message.id === assistantMessage.id,
    );

    expect(returnedAssistant).toBeDefined();
    expect(returnedAssistant.generationId).not.toBe(generation.id);
  });

  it("must not expose another user's generation through a conversation", async () => {
    const foreignGeneration = await prisma.aIGeneration.create({
      data: {
        userId: foreignUserId,
        projectId: foreignProjectId,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "Foreign user's private generation.",
        creditsUsed: 0,
      },
    });

    const userMessage = await prisma.aIMessage.create({
      data: {
        conversationId: projectConversationId,
        userId: ownerId,
        role: "USER",
        content: "Owner request.",
      },
    });

    const assistantMessage = await prisma.aIMessage.create({
      data: {
        conversationId: projectConversationId,
        userId: ownerId,
        role: "ASSISTANT",
        content: "Invalid foreign generation.",
        parentMessageId: userMessage.id,
        generationId: foreignGeneration.id,
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: projectConversationId,
      },
      data: {
        activeMessageId: assistantMessage.id,
      },
    });

    const response = await GET(createGetRequest(projectConversationId));

    expect(response.status).toBe(200);

    const body = await response.json();

    const returnedAssistant = body.messages.find(
      (message: { id: string }) => message.id === assistantMessage.id,
    );

    expect(returnedAssistant).toBeDefined();
    expect(returnedAssistant.generationId).not.toBe(foreignGeneration.id);
  });

  it("allows a global conversation to reference the authenticated user's global generation", async () => {
    const generation = await prisma.aIGeneration.create({
      data: {
        userId: ownerId,
        projectId: null,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "Global generation.",
        creditsUsed: 0,
      },
    });

    const userMessage = await prisma.aIMessage.create({
      data: {
        conversationId: globalConversationId,
        userId: ownerId,
        role: "USER",
        content: "Global request.",
      },
    });

    const assistantMessage = await prisma.aIMessage.create({
      data: {
        conversationId: globalConversationId,
        userId: ownerId,
        role: "ASSISTANT",
        content: "Global response.",
        parentMessageId: userMessage.id,
        generationId: generation.id,
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: globalConversationId,
      },
      data: {
        activeMessageId: assistantMessage.id,
      },
    });

    const response = await GET(createGetRequest(globalConversationId));

    expect(response.status).toBe(200);

    const body = await response.json();

    const returnedAssistant = body.messages.find(
      (message: { id: string }) => message.id === assistantMessage.id,
    );

    expect(returnedAssistant).toBeDefined();
    expect(returnedAssistant.generationId).toBe(generation.id);
  });

  it("must not expose a global generation through a project-scoped conversation", async () => {
    const globalGeneration = await prisma.aIGeneration.create({
      data: {
        userId: ownerId,
        projectId: null,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "Global generation.",
        creditsUsed: 0,
      },
    });

    const userMessage = await prisma.aIMessage.create({
      data: {
        conversationId: secondProjectConversationId,
        userId: ownerId,
        role: "USER",
        content: "Project B request.",
      },
    });

    const assistantMessage = await prisma.aIMessage.create({
      data: {
        conversationId: secondProjectConversationId,
        userId: ownerId,
        role: "ASSISTANT",
        content: "Invalid global generation relationship.",
        parentMessageId: userMessage.id,
        generationId: globalGeneration.id,
      },
    });

    await prisma.aIConversation.update({
      where: {
        id: secondProjectConversationId,
      },
      data: {
        activeMessageId: assistantMessage.id,
      },
    });

    const response = await GET(createGetRequest(secondProjectConversationId));

    expect(response.status).toBe(200);

    const body = await response.json();

    const returnedAssistant = body.messages.find(
      (message: { id: string }) => message.id === assistantMessage.id,
    );

    expect(returnedAssistant).toBeDefined();
    expect(returnedAssistant.generationId).not.toBe(globalGeneration.id);
  });
});
