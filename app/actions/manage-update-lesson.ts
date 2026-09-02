"use server";

import prisma from "@/lib/prisma";
import { ApiResponse } from "@/lib/types";
import { lessonSchema, LessonSchemaType } from "@/lib/zodSchemas";

import { UTApi } from "uploadthing/server";
import { revalidatePath } from "next/cache";
import { requireManager } from "./require-manager";

const utapi = new UTApi();

/* ============================================================
   TYPES
============================================================ */

type FileValue = string | null | undefined;

/* ============================================================
   HELPERS
============================================================ */

/**
 * Extracts the UploadThing file key from either:
 *
 * - a raw key
 * - an UploadThing URL
 *
 * Examples:
 *
 * "abc123"
 * -> "abc123"
 *
 * "https://utfs.io/f/abc123"
 * -> "abc123"
 *
 * "https://uploader.uploadthing.com/f/abc123"
 * -> "abc123"
 */
function extractFileKey(value: FileValue): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const url = new URL(normalized);

      const pathname = url.pathname.split("/").filter(Boolean);

      return pathname[pathname.length - 1] ?? null;
    } catch {
      /*
       * Fall back to simple slash parsing
       * if the value is not a valid URL.
       */
      const parts = normalized.split("/").filter(Boolean);

      return parts[parts.length - 1] ?? null;
    }
  }

  return normalized;
}

/**
 * Returns true when two file references point
 * to the same UploadThing file.
 */
function sameFile(first: FileValue, second: FileValue): boolean {
  return extractFileKey(first) === extractFileKey(second);
}

/**
 * Safely adds a file key to the deletion list.
 *
 * Prevents:
 * - null values
 * - duplicates
 * - accidentally deleting the replacement file
 */
function addFileForDeletion(
  keys: Set<string>,
  oldValue: FileValue,
  newValue: FileValue,
) {
  const oldKey = extractFileKey(oldValue);

  const newKey = extractFileKey(newValue);

  if (oldKey && oldKey !== newKey) {
    keys.add(oldKey);
  }
}

/* ============================================================
   UPDATE LESSON
============================================================ */

export async function updateLesson(
  values: LessonSchemaType,
  lessonId: string,
): Promise<ApiResponse> {
  try {
    /* ==========================================================
       1. AUTHORIZATION
    ========================================================== */

    await requireManager();

    /* ==========================================================
       2. VALIDATE INPUT
    ========================================================== */

    const parsed = lessonSchema.safeParse(values);

    if (!parsed.success) {
      console.error("Invalid lesson data:", parsed.error.flatten());

      return {
        status: "error",
        message: "Please check the lesson information and try again.",
      };
    }

    const data = parsed.data;

    /* ==========================================================
       3. FILE REFERENCES
    ========================================================== */

    const newVideoKey = extractFileKey(data.videoKey);

    const newThumbnailKey = extractFileKey(data.thumbnailKey);

    /*
     * Keep the deletion list outside the
     * transaction because UploadThing is
     * an external service.
     */
    const keysToDelete = new Set<string>();

    /* ==========================================================
       4. UPDATE DATABASE
    ========================================================== */

    await prisma.$transaction(async (tx) => {
      const currentLesson = await tx.lesson.findUnique({
        where: {
          id: lessonId,
        },

        select: {
          id: true,
          productId: true,
          videoKey: true,
          thumbnailKey: true,
        },
      });

      if (!currentLesson) {
        throw new Error("Lesson not found");
      }

      /* ======================================================
           DETERMINE WHICH OLD FILES CAN BE DELETED
        ====================================================== */

      addFileForDeletion(keysToDelete, currentLesson.videoKey, data.videoKey);

      addFileForDeletion(
        keysToDelete,
        currentLesson.thumbnailKey,
        data.thumbnailKey,
      );

      /* ======================================================
           UPDATE LESSON
        ====================================================== */

      await tx.lesson.update({
        where: {
          id: lessonId,
        },

        data: {
          title: data.name,

          description: data.description,

          /*
           * Store the normalized UploadThing
           * keys rather than full URLs.
           *
           * This makes future file management
           * much more reliable.
           */
          videoKey: newVideoKey,

          thumbnailKey: newThumbnailKey,
        },
      });
    });

    /* ==========================================================
       5. DELETE REPLACED FILES
       
       Database update has already succeeded.
       UploadThing cleanup is intentionally performed
       afterwards so an UploadThing failure does not
       roll back the database transaction.
    ========================================================== */

    if (keysToDelete.size > 0) {
      try {
        const keys = Array.from(keysToDelete);

        const deleteResponse = await utapi.deleteFiles(keys);

        console.log("Deleted replaced lesson files:", {
          keys,
          response: deleteResponse,
        });
      } catch (deleteError) {
        /*
         * Do not fail the lesson update merely
         * because cleanup failed.
         *
         * The database now points to the correct
         * files, so the old files can be cleaned
         * up later.
         */
        console.error(
          "Failed to delete replaced lesson files from UploadThing:",
          deleteError,
        );
      }
    }

    /* ==========================================================
       6. REVALIDATE
    ========================================================== */

    revalidatePath(`/educator/products/${data.productId}/edit`);

    revalidatePath(`/manage/products/${data.productId}/edit`);

    /*
     * Also revalidate the lesson's product page
     * if it is used elsewhere in the application.
     */
    revalidatePath(`/educator/products/${data.productId}`);

    /* ==========================================================
       7. SUCCESS
    ========================================================== */

    return {
      status: "success",
      message: "Lesson updated successfully.",
    };
  } catch (error) {
    console.error("updateLesson failed:", error);

    /* ==========================================================
       KNOWN ERRORS
    ========================================================== */

    if (error instanceof Error && error.message === "Lesson not found") {
      return {
        status: "error",
        message: "The lesson could not be found.",
      };
    }

    /* ==========================================================
       GENERIC ERROR
    ========================================================== */

    return {
      status: "error",
      message: "Unable to update the lesson. Please try again.",
    };
  }
}
