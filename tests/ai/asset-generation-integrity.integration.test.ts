import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
  AIAssetType,
  AIGenerationStatus,
  AIGenerationType,
} from "@/lib/generated/prisma/enums";

const testRunId = `asset-generation-integrity-${Date.now()}`;

describe("AIAsset ↔ AIGeneration project integrity", () => {
  let userA: { id: string };
  let userB: { id: string };

  let projectA: { id: string };
  let projectB: { id: string };

  let globalGenerationA: { id: string };
  let projectGenerationA: { id: string };
  let projectGenerationB: { id: string };
  let userBGeneration: { id: string };

  beforeAll(async () => {
    /*
     * ================================================================
     * USERS
     * ================================================================
     */

    userA = await prisma.user.create({
      data: {
        email: `${testRunId}-user-a@example.com`,
        name: "Asset Integrity User A",
      },
      select: {
        id: true,
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `${testRunId}-user-b@example.com`,
        name: "Asset Integrity User B",
      },
      select: {
        id: true,
      },
    });

    /*
     * ================================================================
     * PROJECTS
     * ================================================================
     */

    projectA = await prisma.aIProject.create({
      data: {
        userId: userA.id,
        name: `${testRunId}-project-a`,
        description: "Asset integrity project A",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    projectB = await prisma.aIProject.create({
      data: {
        userId: userA.id,
        name: `${testRunId}-project-b`,
        description: "Asset integrity project B",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    /*
     * ================================================================
     * GENERATIONS
     * ================================================================
     *
     * AIGenerationType does not contain CHAT.
     *
     * Chat-like generations use:
     *
     *   type      = TEXT
     *   operation = CHAT
     *   creditOperation = CHAT
     *
     * The enum values are defined separately in Prisma.
     */

    globalGenerationA = await prisma.aIGeneration.create({
      data: {
        userId: userA.id,
        projectId: null,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        creditOperation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "Global generation for asset integrity test",
        creditsUsed: 0,
      },
      select: {
        id: true,
      },
    });

    projectGenerationA = await prisma.aIGeneration.create({
      data: {
        userId: userA.id,
        projectId: projectA.id,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        creditOperation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "Project A generation for asset integrity test",
        creditsUsed: 0,
      },
      select: {
        id: true,
      },
    });

    projectGenerationB = await prisma.aIGeneration.create({
      data: {
        userId: userA.id,
        projectId: projectB.id,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        creditOperation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "Project B generation for asset integrity test",
        creditsUsed: 0,
      },
      select: {
        id: true,
      },
    });

    userBGeneration = await prisma.aIGeneration.create({
      data: {
        userId: userB.id,
        projectId: null,
        type: AIGenerationType.TEXT,
        operation: "CHAT",
        creditOperation: "CHAT",
        status: AIGenerationStatus.COMPLETED,
        prompt: "User B generation for asset integrity test",
        creditsUsed: 0,
      },
      select: {
        id: true,
      },
    });
  });

  afterAll(async () => {
    /*
     * ================================================================
     * CLEANUP
     * ================================================================
     *
     * Delete dependent records first.
     */

    await prisma.aIAsset.deleteMany({
      where: {
        id: {
          startsWith: testRunId,
        },
      },
    });

    await prisma.aIGeneration.deleteMany({
      where: {
        id: {
          startsWith: testRunId,
        },
      },
    });

    await prisma.aIProject.deleteMany({
      where: {
        id: {
          startsWith: testRunId,
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          startsWith: testRunId,
        },
      },
    });
  });

  /*
   * ================================================================
   * TEST 1
   * Same user + same project generation
   * ================================================================
   */

  it("allows an asset to reference a generation from the same project", async () => {
    const asset = await prisma.aIAsset.create({
      data: {
        id: `${testRunId}-asset-same-project`,
        userId: userA.id,
        projectId: projectA.id,
        generationId: projectGenerationA.id,
        type: AIAssetType.IMAGE,
        name: "Same project asset",
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        generationId: true,
      },
    });

    expect(asset.userId).toBe(userA.id);
    expect(asset.projectId).toBe(projectA.id);
    expect(asset.generationId).toBe(projectGenerationA.id);

    const generation = await prisma.aIGeneration.findUnique({
      where: {
        id: projectGenerationA.id,
      },
      select: {
        userId: true,
        projectId: true,
      },
    });

    expect(generation).not.toBeNull();
    expect(generation?.userId).toBe(asset.userId);
    expect(generation?.projectId).toBe(asset.projectId);
  });

  /*
   * ================================================================
   * TEST 2
   * Same user + different project generation
   * ================================================================
   *
   * The current database schema permits this because:
   *
   *   AIAsset.projectId
   *
   * and
   *
   *   AIAsset.generationId
   *
   * are independent foreign keys.
   *
   * This test verifies that the mismatch can be detected.
   */

  it("detects an asset whose project differs from its generation project", async () => {
    const asset = await prisma.aIAsset.create({
      data: {
        id: `${testRunId}-asset-cross-project`,
        userId: userA.id,
        projectId: projectA.id,
        generationId: projectGenerationB.id,
        type: AIAssetType.IMAGE,
        name: "Cross project asset",
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        generationId: true,
      },
    });

    expect(asset.projectId).toBe(projectA.id);
    expect(asset.generationId).toBe(projectGenerationB.id);

    const generation = await prisma.aIGeneration.findUnique({
      where: {
        id: asset.generationId!,
      },
      select: {
        userId: true,
        projectId: true,
      },
    });

    expect(generation).not.toBeNull();

    expect(generation?.userId).toBe(asset.userId);

    /*
     * Critical integrity assertion:
     *
     * The asset belongs to Project A while the generation belongs
     * to Project B.
     */
    expect(generation?.projectId).not.toBe(asset.projectId);
  });

  /*
   * ================================================================
   * TEST 3
   * Different user's generation
   * ================================================================
   *
   * The foreign key does not prevent this because the referenced
   * generation exists.
   *
   * Application-level ownership validation must prevent it.
   */

  it("detects an asset referencing another user's generation", async () => {
    const asset = await prisma.aIAsset.create({
      data: {
        id: `${testRunId}-asset-foreign-user`,
        userId: userA.id,
        projectId: projectA.id,
        generationId: userBGeneration.id,
        type: AIAssetType.IMAGE,
        name: "Foreign user generation asset",
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        generationId: true,
      },
    });

    const generation = await prisma.aIGeneration.findUnique({
      where: {
        id: asset.generationId!,
      },
      select: {
        userId: true,
        projectId: true,
      },
    });

    expect(generation).not.toBeNull();

    /*
     * Critical ownership assertion:
     *
     * The asset belongs to User A while the generation belongs
     * to User B.
     */
    expect(generation?.userId).not.toBe(asset.userId);
  });

  /*
   * ================================================================
   * TEST 4
   * Project asset + global generation
   * ================================================================
   */

  it("detects a project asset referencing a global generation", async () => {
    const asset = await prisma.aIAsset.create({
      data: {
        id: `${testRunId}-asset-project-global-generation`,
        userId: userA.id,
        projectId: projectA.id,
        generationId: globalGenerationA.id,
        type: AIAssetType.IMAGE,
        name: "Project asset with global generation",
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        generationId: true,
      },
    });

    const generation = await prisma.aIGeneration.findUnique({
      where: {
        id: asset.generationId!,
      },
      select: {
        userId: true,
        projectId: true,
      },
    });

    expect(generation).not.toBeNull();
    expect(generation?.userId).toBe(asset.userId);

    /*
     * A project-scoped asset must not be associated with a
     * global generation.
     */
    expect(asset.projectId).not.toBeNull();
    expect(generation?.projectId).toBeNull();
  });

  /*
   * ================================================================
   * TEST 5
   * Global asset + global generation
   * ================================================================
   */

  it("allows a global asset to reference the user's global generation", async () => {
    const asset = await prisma.aIAsset.create({
      data: {
        id: `${testRunId}-asset-global`,
        userId: userA.id,
        projectId: null,
        generationId: globalGenerationA.id,
        type: AIAssetType.IMAGE,
        name: "Global asset",
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        generationId: true,
      },
    });

    const generation = await prisma.aIGeneration.findUnique({
      where: {
        id: asset.generationId!,
      },
      select: {
        userId: true,
        projectId: true,
      },
    });

    expect(asset.userId).toBe(userA.id);
    expect(asset.projectId).toBeNull();

    expect(generation).not.toBeNull();
    expect(generation?.userId).toBe(userA.id);
    expect(generation?.projectId).toBeNull();
  });

  /*
   * ================================================================
   * TEST 6
   * Asset without generation
   * ================================================================
   *
   * generationId is nullable by design.
   */

  it("allows an asset without a generation reference", async () => {
    const asset = await prisma.aIAsset.create({
      data: {
        id: `${testRunId}-asset-no-generation`,
        userId: userA.id,
        projectId: projectA.id,
        generationId: null,
        type: AIAssetType.IMAGE,
        name: "Standalone project asset",
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        generationId: true,
      },
    });

    expect(asset.userId).toBe(userA.id);
    expect(asset.projectId).toBe(projectA.id);
    expect(asset.generationId).toBeNull();
  });

  /*
   * ================================================================
   * TEST 7
   * Explicit integrity query
   * ================================================================
   *
   * This represents the application-level lookup that should be
   * used when validating an asset's generation relationship.
   */

  it("can identify only generation references matching the asset owner and project", async () => {
    const validAsset = await prisma.aIAsset.create({
      data: {
        id: `${testRunId}-asset-query-valid`,
        userId: userA.id,
        projectId: projectA.id,
        generationId: projectGenerationA.id,
        type: AIAssetType.IMAGE,
        name: "Valid query asset",
      },
      select: {
        generationId: true,
        userId: true,
        projectId: true,
      },
    });

    const invalidAsset = await prisma.aIAsset.create({
      data: {
        id: `${testRunId}-asset-query-invalid`,
        userId: userA.id,
        projectId: projectA.id,
        generationId: projectGenerationB.id,
        type: AIAssetType.IMAGE,
        name: "Invalid query asset",
      },
      select: {
        generationId: true,
        userId: true,
        projectId: true,
      },
    });

    /*
     * Valid:
     *
     * userId matches
     * projectId matches
     */
    const validGeneration = await prisma.aIGeneration.findFirst({
      where: {
        id: validAsset.generationId!,
        userId: validAsset.userId,
        projectId: validAsset.projectId,
      },
      select: {
        id: true,
      },
    });

    /*
     * Invalid:
     *
     * userId matches
     * projectId does NOT match
     */
    const invalidGeneration = await prisma.aIGeneration.findFirst({
      where: {
        id: invalidAsset.generationId!,
        userId: invalidAsset.userId,
        projectId: invalidAsset.projectId,
      },
      select: {
        id: true,
      },
    });

    expect(validGeneration?.id).toBe(projectGenerationA.id);
    expect(invalidGeneration).toBeNull();
  });
});
