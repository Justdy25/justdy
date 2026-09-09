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

const testUserId = `phase5g-library-user-${suffix}`;
const otherUserId = `phase5g-library-other-${suffix}`;

const testUserEmail = `${testUserId}@example.test`;
const otherUserEmail = `${otherUserId}@example.test`;

let testUserCreated = false;
let otherUserCreated = false;

function createRequest(projectId?: string) {
  const url = new URL("http://localhost:3000/api/ai/library");

  if (projectId) {
    url.searchParams.set("projectId", projectId);
  }

  return new Request(url);
}

describe("AI library project-integrity integration", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Phase 5G Library Test User",
        email: testUserEmail,
      },
    });

    testUserCreated = true;

    await prisma.user.create({
      data: {
        id: otherUserId,
        name: "Phase 5G Other User",
        email: otherUserEmail,
      },
    });

    otherUserCreated = true;
  });

  beforeEach(async () => {
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

    mocks.getAuthenticatedUser.mockResolvedValue({
      id: testUserId,
      name: "Phase 5G Library Test User",
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

  it("returns only the authenticated user's assets for an active project", async () => {
    const projectA = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Project A",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const projectB = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Project B",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const otherProject = await prisma.aIProject.create({
      data: {
        userId: otherUserId,
        name: "Other User Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const projectAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: projectA.id,
        type: AIAssetType.DOCUMENT,
        name: "Project A worksheet.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: projectB.id,
        type: AIAssetType.DOCUMENT,
        name: "Project B worksheet.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        type: AIAssetType.DOCUMENT,
        name: "Global worksheet.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: otherUserId,
        projectId: otherProject.id,
        type: AIAssetType.DOCUMENT,
        name: "Other user's worksheet.pdf",
      },
    });

    const response = await GET(createRequest(projectA.id));

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].id).toBe(projectAsset.id);
    expect(body.assets[0].projectId).toBe(projectA.id);
    expect(body.assets[0].name).toBe("Project A worksheet.pdf");
  });

  it("explicitly excludes global assets from a project-scoped request", async () => {
    const project = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Scoped Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const projectAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: project.id,
        type: AIAssetType.DOCUMENT,
        name: "Scoped project asset.pdf",
      },
    });

    const globalAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: null,
        type: AIAssetType.DOCUMENT,
        name: "Global unassigned asset.pdf",
      },
    });

    const response = await GET(createRequest(project.id));

    expect(response.status).toBe(200);

    const body = await response.json();

    const assetIds = body.assets.map((asset: { id: string }) => asset.id);
    const assetNames = body.assets.map((asset: { name: string }) => asset.name);

    expect(assetIds).toEqual([projectAsset.id]);
    expect(assetIds).not.toContain(globalAsset.id);
    expect(assetNames).toEqual(["Scoped project asset.pdf"]);

    for (const asset of body.assets) {
      expect(asset.projectId).toBe(project.id);
    }
  });

  it("rejects a project owned by another user", async () => {
    const otherProject = await prisma.aIProject.create({
      data: {
        userId: otherUserId,
        name: "Foreign Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const response = await GET(createRequest(otherProject.id));

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.error).toBe("Project not found.");
  });

  it("rejects an archived project", async () => {
    const archivedProject = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Archived Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ARCHIVED,
      },
    });

    const response = await GET(createRequest(archivedProject.id));

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.error).toBe("Project not found.");
  });

  it("returns the authenticated user's global and project assets without leaking another user's assets", async () => {
    const ownProject = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Own Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const otherProject = await prisma.aIProject.create({
      data: {
        userId: otherUserId,
        name: "Other Project",
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

    const globalAsset = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: null,
        type: AIAssetType.DOCUMENT,
        name: "Own global asset.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: otherUserId,
        projectId: otherProject.id,
        type: AIAssetType.DOCUMENT,
        name: "Foreign asset.pdf",
      },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(200);

    const body = await response.json();

    const assetIds = body.assets.map((asset: { id: string }) => asset.id);
    const assetNames = body.assets.map((asset: { name: string }) => asset.name);

    expect(assetIds).toEqual(
      expect.arrayContaining([ownProjectAsset.id, globalAsset.id]),
    );

    expect(assetIds).toHaveLength(2);
    expect(assetNames).toContain("Own project asset.pdf");
    expect(assetNames).toContain("Own global asset.pdf");
    expect(assetNames).not.toContain("Foreign asset.pdf");
  });

  it("returns global assets even when the authenticated user has no project assets", async () => {
    const ownProject = await prisma.aIProject.create({
      data: {
        userId: testUserId,
        name: "Empty Project",
        type: AIProjectType.WORKSHEET,
        status: AIProjectStatus.ACTIVE,
      },
    });

    const globalAssetA = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: null,
        type: AIAssetType.DOCUMENT,
        name: "Global resource A.pdf",
      },
    });

    const globalAssetB = await prisma.aIAsset.create({
      data: {
        userId: testUserId,
        projectId: null,
        type: AIAssetType.DOCUMENT,
        name: "Global resource B.pdf",
      },
    });

    await prisma.aIAsset.create({
      data: {
        userId: otherUserId,
        type: AIAssetType.DOCUMENT,
        name: "Foreign global resource.pdf",
      },
    });

    const projectResponse = await GET(createRequest(ownProject.id));

    expect(projectResponse.status).toBe(200);

    const projectBody = await projectResponse.json();

    expect(projectBody.assets).toHaveLength(0);

    const globalResponse = await GET(createRequest());

    expect(globalResponse.status).toBe(200);

    const globalBody = await globalResponse.json();

    const globalAssetIds = globalBody.assets.map(
      (asset: { id: string }) => asset.id,
    );

    const globalAssetNames = globalBody.assets.map(
      (asset: { name: string }) => asset.name,
    );

    expect(globalAssetIds).toEqual(
      expect.arrayContaining([globalAssetA.id, globalAssetB.id]),
    );

    expect(globalAssetIds).toHaveLength(2);

    expect(globalAssetNames).toContain("Global resource A.pdf");
    expect(globalAssetNames).toContain("Global resource B.pdf");
    expect(globalAssetNames).not.toContain("Foreign global resource.pdf");

    for (const asset of globalBody.assets) {
      expect(asset.projectId).toBeNull();
    }
  });
});
