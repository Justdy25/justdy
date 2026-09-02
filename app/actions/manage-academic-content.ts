"use server";

import prisma from "@/lib/prisma";
import { requireManager } from "./require-manager";
import { GradeLevel } from "@/lib/generated/prisma/enums";
import {
  createSubjectSchema,
  updateSubjectSchema,
  createTopicSchema,
  updateTopicSchema,
  CreateSubjectSchemaType,
  UpdateSubjectSchemaType,
  CreateTopicSchemaType,
  UpdateTopicSchemaType,
} from "@/lib/zodSchemas";

/* ============================================================
   TYPES
============================================================ */

export type AcademicSubject = {
  id: string;
  name: string;
  description: string | null;
  topicCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AcademicTopic = {
  id: string;
  name: string;
  slug: string;
  gradeLevel: GradeLevel;
  subjectId: string;
  subjectName: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/* ============================================================
   GET SUBJECTS
============================================================ */

export async function GetAcademicSubjects() {
  try {
    await requireManager();

    const subjects = await prisma.subject.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            topics: true,
          },
        },
      },
    });

    return {
      status: "success" as const,
      data: subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        description: subject.description,
        topicCount: subject._count.topics,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt,
      })),
    };
  } catch (error) {
    console.error("GET SUBJECTS ERROR:", error);

    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Failed to load subjects.",
    };
  }
}

/* ============================================================
   GET TOPICS
============================================================ */

export async function GetAcademicTopics(filters?: {
  gradeLevel?: string;
  subjectId?: string;
}) {
  try {
    await requireManager();

    const where: {
      gradeLevel?: GradeLevel;
      subjectId?: string;
    } = {};

    if (filters?.gradeLevel) {
      where.gradeLevel = filters.gradeLevel as GradeLevel;
    }

    if (filters?.subjectId) {
      where.subjectId = filters.subjectId;
    }

    const topics = await prisma.topic.findMany({
      where,

      orderBy: [
        {
          gradeLevel: "asc",
        },
        {
          name: "asc",
        },
      ],

      include: {
        subject: {
          select: {
            name: true,
          },
        },

        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return {
      status: "success" as const,

      data: topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        gradeLevel: topic.gradeLevel,
        subjectId: topic.subjectId,
        subjectName: topic.subject.name,
        productCount: topic._count.products,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
      })),
    };
  } catch (error) {
    console.error("GET TOPICS ERROR:", error);

    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Failed to load topics.",
    };
  }
}

/* ============================================================
   CREATE SUBJECT
============================================================ */

export async function CreateAcademicSubject(values: CreateSubjectSchemaType) {
  await requireManager();

  try {
    const validation = createSubjectSchema.safeParse(values);

    if (!validation.success) {
      return {
        status: "error" as const,
        message: "Invalid subject information.",
      };
    }

    const name = validation.data.name.trim();
    const description = validation.data.description?.trim() || null;

    const existing = await prisma.subject.findUnique({
      where: {
        name,
      },
    });

    if (existing) {
      return {
        status: "error" as const,
        message: "A subject with this name already exists.",
      };
    }

    const subject = await prisma.subject.create({
      data: {
        name,
        description,
      },

      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return {
      status: "success" as const,
      message: "Subject created successfully.",
      data: subject,
    };
  } catch (error) {
    console.error("CREATE SUBJECT ERROR:", error);

    return {
      status: "error" as const,
      message: "Failed to create subject.",
    };
  }
}

/* ============================================================
   UPDATE SUBJECT
============================================================ */

export async function UpdateAcademicSubject(values: UpdateSubjectSchemaType) {
  await requireManager();

  try {
    const validation = updateSubjectSchema.safeParse(values);

    if (!validation.success) {
      return {
        status: "error" as const,
        message: "Invalid subject information.",
      };
    }

    const { id } = validation.data;

    const name = validation.data.name.trim();

    const description = validation.data.description?.trim() || null;

    const duplicate = await prisma.subject.findFirst({
      where: {
        name,
        NOT: {
          id,
        },
      },
    });

    if (duplicate) {
      return {
        status: "error" as const,
        message: "Another subject already uses this name.",
      };
    }

    const subject = await prisma.subject.update({
      where: {
        id,
      },

      data: {
        name,
        description,
      },

      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return {
      status: "success" as const,
      message: "Subject updated successfully.",
      data: subject,
    };
  } catch (error) {
    console.error("UPDATE SUBJECT ERROR:", error);

    return {
      status: "error" as const,
      message: "Failed to update subject.",
    };
  }
}

/* ============================================================
   DELETE SUBJECT
============================================================ */

export async function DeleteAcademicSubject(id: string) {
  await requireManager();

  try {
    if (!id) {
      return {
        status: "error" as const,
        message: "Invalid subject.",
      };
    }

    const subject = await prisma.subject.findUnique({
      where: {
        id,
      },

      include: {
        _count: {
          select: {
            topics: true,
            products: true,
          },
        },
      },
    });

    if (!subject) {
      return {
        status: "error" as const,
        message: "Subject not found.",
      };
    }

    if (subject._count.topics > 0 || subject._count.products > 0) {
      return {
        status: "error" as const,
        message:
          "This subject cannot be deleted because it is being used by topics or products.",
      };
    }

    await prisma.subject.delete({
      where: {
        id,
      },
    });

    return {
      status: "success" as const,
      message: "Subject deleted successfully.",
    };
  } catch (error) {
    console.error("DELETE SUBJECT ERROR:", error);

    return {
      status: "error" as const,
      message: "Failed to delete subject.",
    };
  }
}

/* ============================================================
   CREATE TOPIC
============================================================ */

export async function CreateAcademicTopic(values: CreateTopicSchemaType) {
  await requireManager();

  try {
    const validation = createTopicSchema.safeParse(values);

    if (!validation.success) {
      return {
        status: "error" as const,
        message: "Invalid topic information.",
      };
    }

    const name = validation.data.name.trim();
    const gradeLevel = validation.data.gradeLevel as GradeLevel;
    const subjectId = validation.data.subjectId;

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: {
        id: subjectId,
      },
    });

    if (!subject) {
      return {
        status: "error" as const,
        message: "Selected subject was not found.",
      };
    }

    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check for duplicate topic
    const existing = await prisma.topic.findUnique({
      where: {
        subjectId_gradeLevel_slug: {
          subjectId,
          gradeLevel,
          slug,
        },
      },
    });

    if (existing) {
      return {
        status: "error" as const,
        message:
          "This topic already exists for the selected grade and subject.",
      };
    }

    // Create topic
    const topic = await prisma.topic.create({
      data: {
        name,
        slug,
        gradeLevel,
        subjectId,
      },

      select: {
        id: true,
        name: true,
        slug: true,
        gradeLevel: true,
        subjectId: true,
        subject: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      status: "success" as const,
      message: "Topic created successfully.",
      data: {
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        gradeLevel: topic.gradeLevel,
        subjectId: topic.subjectId,
        subjectName: topic.subject.name,
      },
    };
  } catch (error) {
    console.error("CREATE TOPIC ERROR:", error);

    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Failed to create topic.",
    };
  }
}

/* ============================================================
   UPDATE TOPIC
============================================================ */

export async function UpdateAcademicTopic(values: UpdateTopicSchemaType) {
  await requireManager();

  try {
    const validation = updateTopicSchema.safeParse(values);

    if (!validation.success) {
      return {
        status: "error" as const,
        message: "Invalid topic information.",
      };
    }

    const id = validation.data.id;
    const name = validation.data.name.trim();
    const gradeLevel = validation.data.gradeLevel as GradeLevel;
    const subjectId = validation.data.subjectId;

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: {
        id: subjectId,
      },
    });

    if (!subject) {
      return {
        status: "error" as const,
        message: "Selected subject was not found.",
      };
    }

    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check duplicate
    const duplicate = await prisma.topic.findFirst({
      where: {
        subjectId,
        gradeLevel,
        slug,
        NOT: {
          id,
        },
      },
    });

    if (duplicate) {
      return {
        status: "error" as const,
        message:
          "Another topic with this name already exists for this grade and subject.",
      };
    }

    const topic = await prisma.topic.update({
      where: {
        id,
      },

      data: {
        name,
        slug,
        gradeLevel,
        subjectId,
      },

      select: {
        id: true,
        name: true,
        slug: true,
        gradeLevel: true,
        subjectId: true,
        subject: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      status: "success" as const,
      message: "Topic updated successfully.",
      data: {
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        gradeLevel: topic.gradeLevel,
        subjectId: topic.subjectId,
        subjectName: topic.subject.name,
      },
    };
  } catch (error) {
    console.error("UPDATE TOPIC ERROR:", error);

    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Failed to update topic.",
    };
  }
}

/* ============================================================
   DELETE TOPIC
============================================================ */

export async function DeleteAcademicTopic(id: string) {
  await requireManager();

  try {
    if (!id) {
      return {
        status: "error" as const,
        message: "Invalid topic.",
      };
    }

    const topic = await prisma.topic.findUnique({
      where: {
        id,
      },

      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!topic) {
      return {
        status: "error" as const,
        message: "Topic not found.",
      };
    }

    if (topic._count.products > 0) {
      return {
        status: "error" as const,
        message:
          "This topic cannot be deleted because it is being used by products.",
      };
    }

    await prisma.topic.delete({
      where: {
        id,
      },
    });

    return {
      status: "success" as const,
      message: "Topic deleted successfully.",
    };
  } catch (error) {
    console.error("DELETE TOPIC ERROR:", error);

    return {
      status: "error" as const,
      message: "Failed to delete topic.",
    };
  }
}
