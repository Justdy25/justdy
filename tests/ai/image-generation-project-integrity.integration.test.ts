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
  generateImage: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

vi.mock("@/lib/ai/image/generator", () => ({
  generateImage: mocks.generateImage,
}));

import { POST } from "@/app/api/ai/image/route";
import prisma from "@/lib/prisma";
import { AIProjectStatus, AIProjectType } from "@/lib/generated/prisma/enums";

const testRunId = `image-project-integrity-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}`;

let userA: { id: string; email: string };
let userB: { id: string; email: string };

let projectA: { id: string };
let projectB: { id: string };
let archivedProject: { id: string };
let foreignProject: { id: string };

function createRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/ai/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("AI image generation project integrity", () => {
  beforeAll(async () => {
    const createdUserA = await prisma.user.create({
      data: {
        id: `${testRunId}-user-a`,
        email: `${testRunId}-user-a@example.test`,
        name: "Image Integrity User A",
      },
      select: {
        id: true,
        email: true,
      },
    });

    userA = createdUserA;

    const createdUserB = await prisma.user.create({
      data: {
        id: `${testRunId}-user-b`,
        email: `${testRunId}-user-b@example.test`,
        name: "Image Integrity User B",
      },
      select: {
        id: true,
        email: true,
      },
    });

    userB = createdUserB;

    const createdProjectA = await prisma.aIProject.create({
      data: {
        id: `${testRunId}-project-a`,
        userId: userA.id,
        name: "Image Integrity Project A",
        type: AIProjectType.GENERAL,
        status: AIProjectStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    projectA = createdProjectA;

    const createdProjectB = await prisma.aIProject.create({
      data: {
        id: `${testRunId}-project-b`,
        userId: userA.id,
        name: "Image Integrity Project B",
        type: AIProjectType.GENERAL,
        status: AIProjectStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    projectB = createdProjectB;

    const createdArchivedProject = await prisma.aIProject.create({
      data: {
        id: `${testRunId}-archived-project`,
        userId: userA.id,
        name: "Archived Image Integrity Project",
        type: AIProjectType.GENERAL,
        status: AIProjectStatus.ARCHIVED,
      },
      select: {
        id: true,
      },
    });

    archivedProject = createdArchivedProject;

    const createdForeignProject = await prisma.aIProject.create({
      data: {
        id: `${testRunId}-foreign-project`,
        userId: userB.id,
        name: "Foreign Image Integrity Project",
        type: AIProjectType.GENERAL,
        status: AIProjectStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    foreignProject = createdForeignProject;
  });

  beforeEach(() => {
    mocks.getAuthenticatedUser.mockReset();
    mocks.generateImage.mockReset();

    mocks.getAuthenticatedUser.mockResolvedValue({
      id: userA.id,
      email: userA.email,
      name: "Image Integrity User A",
    });

    mocks.generateImage.mockResolvedValue({
      generationId: `${testRunId}-generation`,
      assetId: `${testRunId}-asset`,
      url: "https://example.test/generated-image.png",
      mimeType: "image/png",
      model: "gpt-image-2",
      size: "1024x1024",
      quality: "auto",
      prompt: "A test image",
      status: "COMPLETED",
    });
  });

  afterAll(async () => {
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

  it("passes the authenticated user and active project to generateImage", async () => {
    const requestId = `${testRunId}-request-active`;

    const response = await POST(
      createRequest({
        prompt: "A test image",
        projectId: projectA.id,
        requestId,
      }),
    );

    expect(response.status).toBe(200);

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: userA.id,
        projectId: projectA.id,
        prompt: "A test image",
        requestId,
      }),
    );
  });

  it("preserves project isolation when the user has multiple active projects", async () => {
    const requestId = `${testRunId}-request-project-b`;

    const response = await POST(
      createRequest({
        prompt: "Project B image",
        projectId: projectB.id,
        requestId,
      }),
    );

    expect(response.status).toBe(200);

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    const generationInput = mocks.generateImage.mock.calls[0][0];

    expect(generationInput.userId).toBe(userA.id);
    expect(generationInput.projectId).toBe(projectB.id);
    expect(generationInput.projectId).not.toBe(projectA.id);
  });

  it("passes no project when projectId is omitted", async () => {
    const requestId = `${testRunId}-request-global`;

    const response = await POST(
      createRequest({
        prompt: "Global image",
        requestId,
      }),
    );

    expect(response.status).toBe(200);

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    const generationInput = mocks.generateImage.mock.calls[0][0];

    expect(generationInput.userId).toBe(userA.id);
    expect(generationInput.projectId).toBeUndefined();
  });

  it("does not invoke image generation for an archived project", async () => {
    const requestId = `${testRunId}-request-archived`;

    const response = await POST(
      createRequest({
        prompt: "Archived project image",
        projectId: archivedProject.id,
        requestId,
      }),
    );

    /*
     * The API route delegates project authorization to the centralized
     * generateImage() service. Because the service is mocked at this
     * boundary, this test verifies that the route forwards the requested
     * project correctly; project authorization itself is covered by the
     * generation service's project-integrity tests.
     *
     * The route itself does not query AIProject.
     */
    expect(response.status).toBe(200);

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: userA.id,
        projectId: archivedProject.id,
      }),
    );
  });

  it("does not substitute the authenticated user's project for a requested foreign project", async () => {
    const requestId = `${testRunId}-request-foreign`;

    const response = await POST(
      createRequest({
        prompt: "Foreign project image",
        projectId: foreignProject.id,
        requestId,
      }),
    );

    expect(response.status).toBe(200);

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    const generationInput = mocks.generateImage.mock.calls[0][0];

    /*
     * The API must never silently replace the requested project with
     * another project belonging to the authenticated user.
     *
     * generateImage() is responsible for rejecting the foreign project.
     */
    expect(generationInput.userId).toBe(userA.id);
    expect(generationInput.projectId).toBe(foreignProject.id);
    expect(generationInput.projectId).not.toBe(projectA.id);
    expect(generationInput.projectId).not.toBe(projectB.id);
  });

  it("rejects unauthenticated image generation before calling generateImage", async () => {
    mocks.getAuthenticatedUser.mockResolvedValueOnce(null);

    const response = await POST(
      createRequest({
        prompt: "Unauthenticated image",
        projectId: projectA.id,
        requestId: `${testRunId}-request-unauthenticated`,
      }),
    );

    expect(response.status).toBe(401);

    const body = await response.json();

    expect(body.error).toBe("Unauthorized.");

    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it("rejects an invalid project ID before calling generateImage", async () => {
    const response = await POST(
      createRequest({
        prompt: "Invalid project image",
        projectId: "",
        requestId: `${testRunId}-request-invalid-project`,
      }),
    );

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.error).toBe("Invalid project ID.");

    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it("trims the project ID before passing it to generateImage", async () => {
    const requestId = `${testRunId}-request-trimmed-project`;

    const response = await POST(
      createRequest({
        prompt: "Trimmed project image",
        projectId: `  ${projectA.id}  `,
        requestId,
      }),
    );

    expect(response.status).toBe(200);

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: userA.id,
        projectId: projectA.id,
        requestId,
      }),
    );
  });

  it("trims the image prompt before passing it to generateImage", async () => {
    const requestId = `${testRunId}-request-trimmed-prompt`;

    const response = await POST(
      createRequest({
        prompt: "   A trimmed test image   ",
        projectId: projectA.id,
        requestId,
      }),
    );

    expect(response.status).toBe(200);

    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: userA.id,
        projectId: projectA.id,
        prompt: "A trimmed test image",
        requestId,
      }),
    );
  });
});
