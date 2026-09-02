"use server";

import "server-only";

import prisma from "@/lib/prisma";
import { GradeLevel } from "@/lib/generated/prisma/client";

export async function GetAIVideoSubjects() {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });

    return {
      success: true as const,
      subjects,
    };
  } catch (error) {
    console.error("GetAIVideoSubjects error:", error);

    return {
      success: false as const,
      subjects: [],
      error: "Unable to load subjects.",
    };
  }
}

export async function GetAIVideoTopics(
  subjectId: string,
  gradeLevel: GradeLevel,
) {
  try {
    if (!subjectId || !gradeLevel) {
      return {
        success: true as const,
        topics: [],
      };
    }

    const topics = await prisma.topic.findMany({
      where: {
        subjectId,
        gradeLevel,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
      },
    });

    return {
      success: true as const,
      topics,
    };
  } catch (error) {
    console.error("GetAIVideoTopics error:", error);

    return {
      success: false as const,
      topics: [],
      error: "Unable to load topics.",
    };
  }
}
