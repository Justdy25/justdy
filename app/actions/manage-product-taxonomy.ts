"use server";

import prisma from "@/lib/prisma";
import { GradeLevel } from "@/lib/generated/prisma/enums";

/* ============================================================
   GET SUBJECTS
============================================================ */

export async function GetProductSubjects() {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: {
        name: "asc",
      },

      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return {
      status: "success" as const,
      data: subjects,
    };
  } catch (error) {
    console.error("GET SUBJECTS ERROR:", error);

    return {
      status: "error" as const,
      message: "Failed to load subjects.",
    };
  }
}

/* ============================================================
   GET TOPICS
============================================================ */

export async function GetProductTopics(gradeLevel: string, subjectId: string) {
  try {
    /* --------------------------------------------------------
       Validate grade level
    -------------------------------------------------------- */

    if (!gradeLevel) {
      return {
        status: "error" as const,
        message: "Grade level is required.",
      };
    }

    /* --------------------------------------------------------
       Validate subject
    -------------------------------------------------------- */

    if (!subjectId) {
      return {
        status: "error" as const,
        message: "Subject is required.",
      };
    }

    /* --------------------------------------------------------
       Make sure grade is a valid Prisma GradeLevel
    -------------------------------------------------------- */

    const validGradeLevels = Object.values(GradeLevel) as string[];

    if (!validGradeLevels.includes(gradeLevel)) {
      return {
        status: "error" as const,
        message: "Invalid grade level.",
      };
    }

    /* --------------------------------------------------------
       Verify subject exists
    -------------------------------------------------------- */

    const subject = await prisma.subject.findUnique({
      where: {
        id: subjectId,
      },

      select: {
        id: true,
      },
    });

    if (!subject) {
      return {
        status: "error" as const,
        message: "Subject not found.",
      };
    }

    /* --------------------------------------------------------
       Get topics for:
       
       Grade Level
            +
       Subject
    -------------------------------------------------------- */

    const topics = await prisma.topic.findMany({
      where: {
        gradeLevel: gradeLevel as GradeLevel,
        subjectId,
      },

      orderBy: {
        name: "asc",
      },

      select: {
        id: true,
        name: true,
        slug: true,
        gradeLevel: true,
        subjectId: true,
      },
    });

    /* --------------------------------------------------------
       Return topics
    -------------------------------------------------------- */

    return {
      status: "success" as const,
      data: topics,
    };
  } catch (error) {
    console.error("GET TOPICS ERROR:", error);

    return {
      status: "error" as const,
      message: "Failed to load topics.",
    };
  }
}
