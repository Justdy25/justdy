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

import { GET } from "@/app/api/ai/library/route";
import prisma from "@/lib/prisma";
import {
  AIAssetType,
  AIProjectStatus,
  AIProjectType,
} from "@/lib/generated/prisma/enums";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const testUserId = `phase5g-asset-retrieval-user-${suffix}`;
const otherUserId = `phase5g-asset-retrieval-other-${suffix}`;

const testUserEmail = `${testUserId}@example.test`;
const otherUserEmail = `${otherUserId}@example.test`;

let testUserCreated = false;
let otherUserCreated = false;

function createRequest(options?: {
  projectId?: string;
  type?: string;
  limit?: string;
  cursor?: string;
}) {
  const url = new URL("http://localhost:3000/api/ai/library");

  if (options?.projectId) {
    url.searchParams.set("projectId", options.projectId);
  }

  if (options?.type) {
    url.searchParams.set("type", options.type);
  }

  if (options?.limit) {
    url.searchParams.set("limit", options.limit);
  }

  if (options?.cursor) {
    url.searchParams.set("cursor", options.cursor);
  }

  return new Request(url);
}

describe("AI asset retrieval integrity integration", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Phase 5G Asset Retrieval User",
        email: testUserEmail,
      },
    });

    testUserCreated = true;

    await prisma.user.create({
      data: {
        id: otherUserId,
        name: "Phase 5G Asset Retrieval Other User",
        email: otherUserEmail,
      },
    });

    otherUserCreated = true;
  });

  beforeEach(async () => {
    /*
     * Remove test assets first because they may reference projects.
     */
    await prisma.aIAsset.deleteMany({
      where: {
        userId: {
          in: [testUserId, otherUserId],
        },
      },
    });

    /*
     * Remove projects owned by either test user.
     */
    await prisma.aIProject.deleteMany({
      where: {
        userId: {
          in: [testUserId, otherUserId],
        },
      },
    });

    mocks.getAuthenticatedUser.mockReset();

    mocks.getAuthenticatedUser.mockResolvedValue({
      id: testUserId,
      name: "Phase 5G Asset Retrieval User",
      email: testUserEmail,
    });
  });

  afterAll(async () => {
    await prisma.aIAsset.deleteMany({
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

  /*
   * ================================================================
   * TEST 1
   * Authenticated user only
   * ================================================================
   *
   * The global library request must return only assets belonging to
   * the authenticated user.
   */

  it("returns only assets belonging to the authenticated user", async () => {
    const ownAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        type: AIAssetType.DOCUMENT,
        name: "Authenticated user's asset.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: otherUserId,
        type: AIAssetType.DOCUMENT,
        name: "Other user's asset.pdf",
      },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.assets).toHaveLength(1);

    expect(body.assets[0].id).toBe(ownAsset.id);
    expect(body.assets[0].name).toBe("Authenticated user's asset.pdf");
  });

  /*
   * ================================================================
   * TEST 2
   * Project-scoped retrieval
   * ================================================================
   *
   * Requesting Project A must return Project A assets only.
   *
   * Project B and global assets must not appear.
   */

  it("returns only assets belonging to the requested active project", async () => {
    const projectA = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Retrieval Project A",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const projectB = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Retrieval Project B",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const projectAAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: projectA.id,
        type: AIAssetType.DOCUMENT,
        name: "Project A asset.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: projectB.id,
        type: AIAssetType.DOCUMENT,
        name: "Project B asset.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: null,
        type: AIAssetType.DOCUMENT,
        name: "Global asset.pdf",
      },
    });

    const response = await GET(
      createRequest({
        projectId: projectA.id,
      }),
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.assets).toHaveLength(1);

    expect(body.assets[0].id).toBe(projectAAsset.id);
    expect(body.assets[0].projectId).toBe(projectA.id);
    expect(body.assets[0].name).toBe("Project A asset.pdf");
  });

  /*
   * ================================================================
   * TEST 3
   * Foreign project protection
   * ================================================================
   *
   * A user must not be able to use another user's projectId to
   * retrieve that project's assets.
   */

  it("rejects a project belonging to another user", async () => {
    const foreignProject = await prisma.aIProject.create({
      data: {
        userId: otherUserId,
        name: "Foreign Retrieval Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: otherUserId,
        projectId: foreignProject.id,
        type: AIAssetType.DOCUMENT,
        name: "Foreign project secret.pdf",
      },
    });

    const response = await GET(
      createRequest({
        projectId: foreignProject.id,
      }),
    );

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.error).toBe("Project not found.");
  });

  /*
   * ================================================================
   * TEST 4
   * Archived project protection
   * ================================================================
   *
   * Archived projects cannot be used as project-scoped retrieval
   * boundaries.
   */

  it("rejects an archived project", async () => {
    const archivedProject = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Archived Retrieval Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ARCHIVED,
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: archivedProject.id,
        type: AIAssetType.DOCUMENT,
        name: "Archived project asset.pdf",
      },
    });

    const response = await GET(
      createRequest({
        projectId: archivedProject.id,
      }),
    );

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.error).toBe("Project not found.");
  });

  /*
   * ================================================================
   * TEST 5
   * Global library behavior
   * ================================================================
   *
   * A request without projectId returns the authenticated user's
   * global AND project assets.
   *
   * Another user's assets must never appear.
   */

  it("returns the authenticated user's global and project assets without leaking foreign assets", async () => {
    const ownProject = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Own Retrieval Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const foreignProject = await prisma.aIProject.create({
      data: {
        userId: otherUserId,
        name: "Foreign Retrieval Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const ownProjectAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: ownProject.id,
        type: AIAssetType.DOCUMENT,
        name: "Own project asset.pdf",
      },
    });

    const ownGlobalAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: null,
        type: AIAssetType.IMAGE,
        name: "Own global asset.png",
      },
    });

    const foreignAsset = await prisma.aIAsset.create({
      data: {
        userId: otherUserId,
        projectId: foreignProject.id,
        type: AIAssetType.DOCUMENT,
        name: "Foreign asset.pdf",
      },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);

    const assetIds = body.assets.map((asset: { id: string }) => asset.id);

    expect(assetIds).toEqual(
      expect.arrayContaining([ownProjectAsset.id, ownGlobalAsset.id]),
    );

    expect(assetIds).not.toContain(foreignAsset.id);
    expect(assetIds).toHaveLength(2);
  });

  /*
   * ================================================================
   * TEST 6
   * Asset type filtering
   * ================================================================
   *
   * The type filter must be applied in addition to user ownership
   * and project scope.
   */

  it("applies asset type filtering without bypassing ownership", async () => {
    const ownImage = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        type: AIAssetType.IMAGE,
        name: "Own image.png",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        type: AIAssetType.DOCUMENT,
        name: "Own document.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: otherUserId,
        type: AIAssetType.IMAGE,
        name: "Foreign image.png",
      },
    });

    const response = await GET(
      createRequest({
        type: "IMAGE",
      }),
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.assets).toHaveLength(1);

    expect(body.assets[0].id).toBe(ownImage.id);
    expect(body.assets[0].type).toBe(AIAssetType.IMAGE);
    expect(body.assets[0].name).toBe("Own image.png");
  });

  /*
   * ================================================================
   * TEST 7
   * Invalid type
   * ================================================================
   *
   * Invalid asset types must be rejected before querying assets.
   */

  it("rejects an invalid asset type", async () => {
    const response = await GET(
      createRequest({
        type: "INVALID_ASSET_TYPE",
      }),
    );

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.error).toBe("Invalid library asset type.");

    expect(body.allowedTypes).toEqual([
      "DOCUMENT",
      "IMAGE",
      "VIDEO",
      "AUDIO",
      "OTHER",
    ]);
  });

  /*
   * ================================================================
   * TEST 8
   * Unauthenticated request
   * ================================================================
   *
   * The library must never return assets without authentication.
   */

  it("rejects an unauthenticated asset retrieval request", async () => {
    mocks.getAuthenticatedUser.mockResolvedValueOnce(null);

    const response = await GET(createRequest());

    expect(response.status).toBe(401);

    const body = await response.json();

    expect(body.error).toBe("Unauthorized.");
  });

  /*
   * ================================================================
   * TEST 9
   * Project filter + ownership simultaneously
   * ================================================================
   *
   * This explicitly verifies that projectId cannot be used to bypass
   * userId filtering.
   */

  it("enforces both authenticated-user ownership and project scope", async () => {
    const ownProject = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Own Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const foreignProject = await prisma.aIProject.create({
      data: {
        userId: otherUserId,
        name: "Foreign Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const ownAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: ownProject.id,
        type: AIAssetType.DOCUMENT,
        name: "Own asset.pdf",
      },
    });

    const foreignAsset = await prisma.aIAsset.create({
      data: {
        userId: otherUserId,
        projectId: foreignProject.id,
        type: AIAssetType.DOCUMENT,
        name: "Foreign asset.pdf",
      },
    });

    /*
     * Normal own-project request.
     */
    const ownResponse = await GET(
      createRequest({
        projectId: ownProject.id,
      }),
    );

    expect(ownResponse.status).toBe(200);

    const ownBody = await ownResponse.json();

    expect(ownBody.assets).toHaveLength(1);
    expect(ownBody.assets[0].id).toBe(ownAsset.id);
    expect(ownBody.assets[0].id).not.toBe(foreignAsset.id);

    /*
     * Attempt to use the foreign project ID.
     *
     * This must fail at the project authorization boundary rather
     * than simply returning an empty asset list.
     */
    const foreignResponse = await GET(
      createRequest({
        projectId: foreignProject.id,
      }),
    );

    expect(foreignResponse.status).toBe(404);

    const foreignBody = await foreignResponse.json();

    expect(foreignBody.error).toBe("Project not found.");
  });
});
