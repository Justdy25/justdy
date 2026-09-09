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
  startAIGenerationAtomic: vi.fn(),
  refundAICreditsAtomic: vi.fn(),
  generateAIResponse: vi.fn(),
}));

vi.mock("@/lib/ai/credits.atomic", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ai/credits.atomic")
  >("@/lib/ai/credits.atomic");

  return {
    ...actual,
    startAIGenerationAtomic: mocks.startAIGenerationAtomic,
    refundAICreditsAtomic: mocks.refundAICreditsAtomic,
  };
});

vi.mock("@/lib/ai/orchestrator", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/orchestrator")>(
    "@/lib/ai/orchestrator",
  );

  return {
    ...actual,
    generateAIResponse: mocks.generateAIResponse,
  };
});

import { generateAI } from "@/lib/ai/generation/generate";
import prisma from "@/lib/prisma";
import {
  AIGenerationStatus,
  AIProjectStatus,
  AIProjectType,
} from "@/lib/generated/prisma/enums";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const testUserId = `phase5g-generation-user-${suffix}`;
const otherUserId = `phase5g-generation-other-${suffix}`;

const testUserEmail = `${testUserId}@example.test`;
const otherUserEmail = `${otherUserId}@example.test`;

let testUserCreated = false;
let otherUserCreated = false;

describe("AI generation project-integrity integration", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Phase 5G Generation Test User",
        email: testUserEmail,
      },
    });

    testUserCreated = true;

    await prisma.user.create({
      data: {
        id: otherUserId,
        name: "Phase 5G Generation Other User",
        email: otherUserEmail,
      },
    });

    otherUserCreated = true;
  });

  beforeEach(async () => {
    /*
     * Remove generations before projects because generations reference
     * their projects.
     */
    await prisma.aIGeneration.deleteMany({
      where: {
        userId: {
          in: [testUserId, otherUserId],
        },
      },
    });

    await prisma.aIProject.deleteMany({
      where: {
        userId: {
          in: [testUserId, otherUserId],
        },
      },
    });

    /*
     * The real startAIGenerationAtomic() transitions the generation into
     * PROCESSING and returns the credit result. Reproduce only that
     * persistence boundary here so generateAI() can execute normally.
     */
    mocks.startAIGenerationAtomic.mockImplementation(
      async ({ generationId }: { generationId: string }) => {
        await prisma.aIGeneration.update({
          where: {
            id: generationId,
          },
          data: {
            status: AIGenerationStatus.PROCESSING,
          },
        });

        return {
          cost: 0,
          balance: 100,
        };
      },
    );

    mocks.refundAICreditsAtomic.mockResolvedValue(undefined);

    mocks.generateAIResponse.mockResolvedValue({
      text: "Test AI response",
      provider: "test-provider",
      model: "test-model",
    });
  });

  afterAll(async () => {
    await prisma.aIGeneration.deleteMany({
      where: {
        userId: {
          in: [testUserId, otherUserId],
        },
      },
    });

    await prisma.aIProject.deleteMany({
      where: {
        userId: {
          in: [testUserId, otherUserId],
        },
      },
    });

    if (testUserCreated) {
      await prisma.user.deleteMany({
        where: {
          id: testUserId,
        },
      });
    }

    if (otherUserCreated) {
      await prisma.user.deleteMany({
        where: {
          id: otherUserId,
        },
      });
    }

    await prisma.$disconnect();
  });

  it("persists an AI generation with the authenticated user's active project", async () => {
    const project = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Generation Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const result = await generateAI({
      userId: testUserId,
      operation: "CHAT",
      prompt: "Create a test response.",
      projectId: project.id,
      requestId: `phase5g-generation-request-${suffix}`,
    });

    expect(result.generationId).toBeTruthy();
    expect(result.projectId).toBe(project.id);
    expect(result.text).toBe("Test AI response");
    expect(result.provider).toBe("test-provider");
    expect(result.model).toBe("test-model");

    const generation = await prisma.aIGeneration.findUnique({
      where: {
        id: result.generationId,
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        status: true,
      },
    });

    expect(generation).not.toBeNull();
    expect(generation?.userId).toBe(testUserId);
    expect(generation?.projectId).toBe(project.id);
    expect(generation?.status).toBe(AIGenerationStatus.COMPLETED);
  });

  it("rejects another user's project before creating a generation", async () => {
    const otherProject = await prisma.aIProject.create({
      data: {
        userId: otherUserId,
        name: "Foreign Generation Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    await expect(
      generateAI({
        userId: testUserId,
        operation: "CHAT",
        prompt: "Attempt to use another user's project.",
        projectId: otherProject.id,
        requestId: `phase5g-foreign-request-${suffix}`,
      }),
    ).rejects.toThrow("AI project not found.");

    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
      },
    });

    expect(generations).toHaveLength(0);
  });

  it("rejects an archived project before creating a generation", async () => {
    const archivedProject = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Archived Generation Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ARCHIVED,
      },
    });

    await expect(
      generateAI({
        userId: testUserId,
        operation: "CHAT",
        prompt: "Attempt to use an archived project.",
        projectId: archivedProject.id,
        requestId: `phase5g-archived-request-${suffix}`,
      }),
    ).rejects.toThrow("AI project not found.");

    const generations = await prisma.aIGeneration.findMany({
      where: {
        userId: testUserId,
      },
    });

    expect(generations).toHaveLength(0);
  });

  it("creates a global generation when no projectId is supplied", async () => {
    const result = await generateAI({
      userId: testUserId,
      operation: "CHAT",
      prompt: "Create a global test response.",
      requestId: `phase5g-global-request-${suffix}`,
    });

    expect(result.generationId).toBeTruthy();
    expect(result.projectId).toBeNull();
    expect(result.text).toBe("Test AI response");

    const generation = await prisma.aIGeneration.findUnique({
      where: {
        id: result.generationId,
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        status: true,
      },
    });

    expect(generation).not.toBeNull();
    expect(generation?.userId).toBe(testUserId);
    expect(generation?.projectId).toBeNull();
    expect(generation?.status).toBe(AIGenerationStatus.COMPLETED);
  });
});
