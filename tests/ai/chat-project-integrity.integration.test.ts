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

const testRunId = `chat-project-integrity-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}`;

const ownerId = `${testRunId}-owner`;
const foreignUserId = `${testRunId}-foreign`;

const ownerEmail = `${ownerId}@example.test`;
const foreignEmail = `${foreignUserId}@example.test`;

const ownerProjectId = `${testRunId}-owner-project`;
const secondOwnerProjectId = `${testRunId}-owner-project-2`;
const foreignProjectId = `${testRunId}-foreign-project`;
const archivedProjectId = `${testRunId}-archived-project`;

const ownerConversationId = `${testRunId}-owner-conversation`;
const secondOwnerConversationId = `${testRunId}-owner-conversation-2`;
const foreignConversationId = `${testRunId}-foreign-conversation`;

function createGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/ai/chat");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return new Request(url);
}

describe("AI chat project integrity", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          name: "Chat Project Integrity Owner",
          email: ownerEmail,
        },
        {
          id: foreignUserId,
          name: "Chat Project Integrity Foreign User",
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
        {
          id: archivedProjectId,
          userId: ownerId,
          name: "Archived Project",
          type: "GENERAL",
          status: "ARCHIVED",
        },
      ],
    });

    await prisma.aIConversation.createMany({
      data: [
        {
          id: ownerConversationId,
          userId: ownerId,
          projectId: ownerProjectId,
          title: "Owner Project Conversation",
          status: "ACTIVE",
        },
        {
          id: secondOwnerConversationId,
          userId: ownerId,
          projectId: secondOwnerProjectId,
          title: "Second Project Conversation",
          status: "ACTIVE",
        },
        {
          id: foreignConversationId,
          userId: foreignUserId,
          projectId: foreignProjectId,
          title: "Foreign Conversation",
          status: "ACTIVE",
        },
      ],
    });
  });

  beforeEach(() => {
    mocks.getAuthenticatedUser.mockResolvedValue({
      id: ownerId,
      name: "Chat Project Integrity Owner",
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

    await prisma.aIConversation.deleteMany({
      where: {
        id: {
          in: [
            ownerConversationId,
            secondOwnerConversationId,
            foreignConversationId,
          ],
        },
      },
    });

    await prisma.aIProject.deleteMany({
      where: {
        id: {
          in: [
            ownerProjectId,
            secondOwnerProjectId,
            foreignProjectId,
            archivedProjectId,
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [ownerId, foreignUserId],
        },
      },
    });

    await prisma.$disconnect();
  });

  it("returns only conversations belonging to the requested active project", async () => {
    const response = await GET(
      createGetRequest({
        projectId: ownerProjectId,
      }),
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].id).toBe(ownerConversationId);
    expect(body.conversations[0].projectId).toBe(ownerProjectId);
  });

  it("does not allow a user to access another user's project", async () => {
    const response = await GET(
      createGetRequest({
        projectId: foreignProjectId,
      }),
    );

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.error).toBe("Project not found or is no longer active.");
    expect(body.code).toBe("CONVERSATION_NOT_FOUND");
  });

  it("does not allow access to an archived project", async () => {
    const response = await GET(
      createGetRequest({
        projectId: archivedProjectId,
      }),
    );

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.error).toBe("Project not found or is no longer active.");
    expect(body.code).toBe("CONVERSATION_NOT_FOUND");
  });

  it("scopes a conversation lookup to both the authenticated user and project", async () => {
    const response = await GET(
      createGetRequest({
        conversationId: ownerConversationId,
        projectId: secondOwnerProjectId,
      }),
    );

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.error).toBe("Conversation not found.");
    expect(body.code).toBe("CONVERSATION_NOT_FOUND");
  });

  it("does not expose another user's conversation by conversationId", async () => {
    const response = await GET(
      createGetRequest({
        conversationId: foreignConversationId,
        projectId: foreignProjectId,
      }),
    );

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.error).toBe("Project not found or is no longer active.");
    expect(body.code).toBe("CONVERSATION_NOT_FOUND");
  });

  it("returns the authenticated user's active conversations across projects when no project filter is supplied", async () => {
    const response = await GET(createGetRequest({}));

    expect(response.status).toBe(200);

    const body = await response.json();

    const conversationIds = body.conversations.map(
      (conversation: { id: string }) => conversation.id,
    );

    expect(conversationIds).toContain(ownerConversationId);
    expect(conversationIds).toContain(secondOwnerConversationId);
    expect(conversationIds).not.toContain(foreignConversationId);
  });
});
