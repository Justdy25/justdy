"use server";

import "server-only";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";
import { GradeLevel, ProductType } from "@/lib/generated/prisma/enums";

const utapi = new UTApi();

export type ProductInput = {
  productId: string;

  title: string;
  description: string;

  type: ProductType;

  /** Required academic classification. */
  gradeLevel: GradeLevel;
  subjectId: string;
  topicId: string;

  /** Digital price in cents. */
  price: number;

  /** Printed/physical price in cents. */
  printedPrice?: number | null;

  /** Single product thumbnail. */
  imageKey?: string | null;

  /** Main product/digital file. */
  fileKey: string;
  fileType: string;
  fileSize: number;
};

export async function updateProduct(values: ProductInput) {
  try {
    // ============================================================
    // 1. AUTHENTICATE USER
    // ============================================================

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id;

    if (!userId) {
      return {
        status: "error" as const,
        message: "Unauthorized. Please log in.",
      };
    }

    // ============================================================
    // 2. NORMALIZE + VALIDATE ACADEMIC CLASSIFICATION
    // ============================================================

    const subjectId = values.subjectId?.trim();
    const topicId = values.topicId?.trim();

    if (!values.gradeLevel) {
      return {
        status: "error" as const,
        message: "Grade level is required.",
      };
    }

    if (!subjectId) {
      return {
        status: "error" as const,
        message: "Subject is required.",
      };
    }

    if (!topicId) {
      return {
        status: "error" as const,
        message: "Topic is required.",
      };
    }

    // Verify that the topic belongs to the selected subject and grade.
    const topic = await prisma.topic.findFirst({
      where: {
        id: topicId,
        subjectId,
        gradeLevel: values.gradeLevel,
      },
      select: {
        id: true,
      },
    });

    if (!topic) {
      return {
        status: "error" as const,
        message:
          "Invalid topic. Please select a topic belonging to the selected subject and grade level.",
      };
    }

    // ============================================================
    // 3. GET EXISTING PRODUCT
    // ============================================================

    const product = await prisma.product.findUnique({
      where: {
        id: values.productId,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        imageKey: true,
      },
    });

    // ============================================================
    // 4. VERIFY OWNERSHIP
    // ============================================================

    if (!product || product.userId !== userId) {
      return {
        status: "error" as const,
        message: "Product not found or access denied.",
      };
    }

    // ============================================================
    // 5. VALIDATE DIGITAL PRICE
    // ============================================================

    const newPriceInCents = Math.round(Number(values.price));

    if (!Number.isFinite(newPriceInCents) || newPriceInCents < 0) {
      return {
        status: "error" as const,
        message: "Invalid product price.",
      };
    }

    // ============================================================
    // 6. VALIDATE PRINTED PRICE
    // ============================================================

    let newPrintedPriceInCents: number | null = null;

    if (product.type !== ProductType.Course) {
      if (values.printedPrice !== undefined && values.printedPrice !== null) {
        const parsedPrintedPrice = Math.round(Number(values.printedPrice));

        if (!Number.isFinite(parsedPrintedPrice) || parsedPrintedPrice < 0) {
          return {
            status: "error" as const,
            message: "Invalid printed product price.",
          };
        }

        newPrintedPriceInCents = parsedPrintedPrice;
      }
    }

    // ============================================================
    // 7. PREPARE PRODUCT IMAGE
    // ============================================================

    const oldImageKey = product.imageKey?.trim() || null;
    const imageWasProvided = values.imageKey !== undefined;
    const newImageKey = imageWasProvided
      ? values.imageKey?.trim() || null
      : oldImageKey;
    const imageChanged = imageWasProvided && oldImageKey !== newImageKey;

    // ============================================================
    // 8. UPDATE PRODUCT
    // ============================================================

    await prisma.product.update({
      where: {
        id: values.productId,
      },
      data: {
        title: values.title,
        description: values.description,

        // Academic classification.
        gradeLevel: values.gradeLevel,
        subjectId,
        topicId,

        // Product type.
        type: values.type,

        // Pricing.
        price: newPriceInCents,
        printedPrice: newPrintedPriceInCents,

        // Single product thumbnail.
        // Preserve the existing thumbnail when the caller does not
        // provide imageKey.
        ...(imageWasProvided ? { imageKey: newImageKey } : {}),

        // Main digital asset.
        fileKey: values.fileKey,
        fileType: values.fileType,
        fileSize: values.fileSize,
      },
    });

    // ============================================================
    // 9. CLEAN UP OLD THUMBNAIL
    // ============================================================
    //
    // Only remove the old thumbnail after the database update has
    // succeeded. A storage cleanup failure must not roll back the
    // product update.
    //

    if (imageChanged && oldImageKey) {
      try {
        await utapi.deleteFiles(oldImageKey);
      } catch (utError) {
        console.error(
          "Failed to delete old product thumbnail from UploadThing:",
          utError,
        );
      }
    }

    // ============================================================
    // 10. REVALIDATE PRODUCT PAGES
    // ============================================================

    revalidatePath(`/admin/products/${values.productId}`);
    revalidatePath(`/manage/products/${values.productId}/edit`);
    revalidatePath("/educator/products");
    revalidatePath("/manage/products");
    revalidatePath("/products");
    revalidatePath(`/products/${values.productId}`);

    // ============================================================
    // 11. SUCCESS
    // ============================================================

    return {
      status: "success" as const,
      message: "Product updated successfully!",
    };
  } catch (error) {
    console.error("Product update failed:", error);

    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Failed to update product.",
    };
  }
}
