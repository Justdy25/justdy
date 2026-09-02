"use server";

import arcjet, { fixedWindow } from "@/lib/arcjet";
import prisma from "@/lib/prisma";
import { ApiResponse } from "@/lib/types";
import { productSchema, ProductSchemaType } from "@/lib/zodSchemas";
import { request } from "@arcjet/next";
import { requireManager } from "./require-manager";

import {
  ProductStatus,
  ProductType,
  GradeLevel,
  ProductAccessModel,
} from "@/lib/generated/prisma/enums";

/* ============================================================
   ARCJET
============================================================ */

const aj = arcjet.withRule(
  fixedWindow({
    mode: "LIVE",
    window: "1m",
    max: 5,
  }),
);

/* ============================================================
   CREATE PRODUCT
============================================================ */

export async function CreateProduct(
  values: ProductSchemaType,
): Promise<ApiResponse> {
  /* ==========================================================
     1. AUTHORIZATION
  ========================================================== */

  const session = await requireManager();

  try {
    /* ========================================================
       2. RATE LIMITING
    ======================================================== */

    const req = await request();

    const decision = await aj.protect(req, {
      fingerprint: session.user.id,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return {
          status: "error",
          message:
            "You have exceeded the number of allowed requests. Please try again later.",
        };
      }

      return {
        status: "error",
        message: "Action forbidden.",
      };
    }

    /* ========================================================
       3. VALIDATE FORM DATA
    ======================================================== */

    const validation = productSchema.safeParse(values);

    if (!validation.success) {
      console.error("Product validation failed:", validation.error.flatten());

      return {
        status: "error",
        message: "Invalid Form Data",
      };
    }

    const data = validation.data;

    /* ========================================================
       4. NORMALIZE DATA
    ======================================================== */

    const title = data.title.trim();

    const description = data.description.trim();

    const slug = data.slug.trim();

    const subjectId = data.subjectId.trim();

    const topicId = data.topicId.trim();

    /* ========================================================
       5. BASIC VALIDATION
    ======================================================== */

    if (!title) {
      return {
        status: "error",
        message: "Product title is required.",
      };
    }

    if (!description) {
      return {
        status: "error",
        message: "Product description is required.",
      };
    }

    if (!slug) {
      return {
        status: "error",
        message: "Product slug is required.",
      };
    }

    if (!subjectId) {
      return {
        status: "error",
        message: "Subject is required.",
      };
    }

    if (!topicId) {
      return {
        status: "error",
        message: "Topic is required.",
      };
    }

    /* ========================================================
       6. VERIFY SUBJECT
       
       Make sure the subject actually exists.
    ======================================================== */

    const subject = await prisma.subject.findUnique({
      where: {
        id: subjectId,
      },

      select: {
        id: true,
        name: true,
      },
    });

    if (!subject) {
      return {
        status: "error",
        message: "The selected subject could not be found.",
      };
    }

    /* ========================================================
       7. VERIFY TOPIC
       
       The topic MUST belong to:
       
       Grade Level
           +
       Subject
       
       This prevents invalid combinations.
       
       Example:
       
       VALID:
       Grade 1 → Mathematics → Addition
       
       INVALID:
       Grade 1 → Mathematics → Grade 8 Algebra
    ======================================================== */

    const topic = await prisma.topic.findFirst({
      where: {
        id: topicId,

        subjectId: subjectId,

        gradeLevel: data.gradeLevel as GradeLevel,
      },

      select: {
        id: true,
        name: true,
        slug: true,
        gradeLevel: true,
        subjectId: true,
      },
    });

    if (!topic) {
      return {
        status: "error",
        message:
          "The selected topic does not belong to the selected grade and subject.",
      };
    }

    /* ========================================================
       8. DETERMINE ACCESS MODEL
       
       IMPORTANT:
       
       The client does NOT decide this.
       
       Worksheets
           → SUBSCRIPTION
       
       Everything else
           → INDIVIDUAL
    ======================================================== */

    const accessModel =
      data.type === "Worksheets"
        ? ProductAccessModel.SUBSCRIPTION
        : ProductAccessModel.INDIVIDUAL;

    /* ========================================================
       9. DIGITAL PRICE
       
       Worksheets:
           price = NULL
       
       Other products:
           price required
    ======================================================== */

    let priceInCents: number | null = null;

    if (accessModel === ProductAccessModel.INDIVIDUAL) {
      if (
        data.price === undefined ||
        data.price === null ||
        !Number.isFinite(data.price) ||
        data.price <= 0
      ) {
        return {
          status: "error",
          message: "A valid individual price is required for this product.",
        };
      }

      priceInCents = Math.round(data.price * 100);

      if (!Number.isFinite(priceInCents) || priceInCents <= 0) {
        return {
          status: "error",
          message: "Invalid product price.",
        };
      }
    }

    /* ========================================================
       10. PRINTED PRICE
       
       ONLY WORKBOOKS can have a printed price.
    ======================================================== */

    let printedPriceInCents: number | null = null;

    if (data.type === "Workbooks") {
      if (data.printedPrice !== undefined && data.printedPrice !== null) {
        const printedPrice = Number(data.printedPrice);

        if (!Number.isFinite(printedPrice) || printedPrice < 0) {
          return {
            status: "error",
            message: "Invalid printed price.",
          };
        }

        printedPriceInCents = Math.round(printedPrice * 100);
      }

      /* ------------------------------------------------------
         Printed price cannot be lower than digital price.
      ------------------------------------------------------ */

      if (
        printedPriceInCents !== null &&
        priceInCents !== null &&
        printedPriceInCents < priceInCents
      ) {
        return {
          status: "error",
          message: "Printed price cannot be lower than the digital price.",
        };
      }
    }

    /* ========================================================
       11. COURSE VALIDATION
    ======================================================== */

    let duration: number | null = null;

    let category: string | null = null;

    if (data.type === "Course") {
      /* ------------------------------------------------------
         Duration
      ------------------------------------------------------ */

      if (
        data.duration === undefined ||
        data.duration === null ||
        !Number.isFinite(data.duration) ||
        data.duration <= 0
      ) {
        return {
          status: "error",
          message: "Course duration is required.",
        };
      }

      duration = data.duration;

      /* ------------------------------------------------------
         Category
      ------------------------------------------------------ */

      if (data.category && data.category.trim()) {
        category = data.category.trim();
      }
    }

    /* ========================================================
       12. STATUS
       
       New products always begin as Draft.
    ======================================================== */

    const status = ProductStatus.Draft;

    /* ========================================================
       13. CREATE PRODUCT
    ======================================================== */

    const product = await prisma.product.create({
      data: {
        /* ==================================================
             BASIC INFORMATION
          ================================================== */

        title,

        description,

        slug,

        /* ==================================================
             ACADEMIC CLASSIFICATION
             
             Grade
                ↓
             Subject
                ↓
             Topic
          ================================================== */

        gradeLevel: data.gradeLevel as GradeLevel,

        subjectId,

        topicId,

        /* ==================================================
             PRODUCT TYPE
          ================================================== */

        type: data.type as ProductType,

        /* ==================================================
             ACCESS MODEL
          ================================================== */

        accessModel,

        /* ==================================================
             STATUS
          ================================================== */

        status,

        /* ==================================================
             PRICING
          ================================================== */

        price: priceInCents,

        printedPrice: data.type === "Workbooks" ? printedPriceInCents : null,

        /* ==================================================
             OWNER
          ================================================== */

        userId: session.user.id,

        /* ==================================================
             COURSE INFORMATION
          ================================================== */

        duration,

        category,

        /* ==================================================
             DIGITAL FILE
          ================================================== */

        fileKey: data.fileKey?.trim() || null,
      },

      /* ====================================================
           RETURN CREATED PRODUCT
        ==================================================== */

      select: {
        id: true,

        title: true,

        gradeLevel: true,

        subjectId: true,

        topicId: true,

        type: true,

        accessModel: true,

        price: true,

        printedPrice: true,

        status: true,

        subject: {
          select: {
            id: true,
            name: true,
          },
        },

        topic: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    /* ========================================================
       14. LOG PRODUCT
    ======================================================== */

    console.log("PRODUCT CREATED:", {
      id: product.id,

      title: product.title,

      gradeLevel: product.gradeLevel,

      subjectId: product.subjectId,

      subject: product.subject?.name,

      topicId: product.topicId,

      topic: product.topic?.name,

      type: product.type,

      accessModel: product.accessModel,

      priceInCents: product.price,

      printedPriceInCents: product.printedPrice,

      status: product.status,
    });

    /* ========================================================
       15. SUCCESS
    ======================================================== */

    return {
      status: "success",
      message: "Product Created Successfully",
    };
  } catch (error) {
    /* ========================================================
       16. ERROR HANDLING
    ======================================================== */

    console.error("SERVER ACTION ERROR:", error);

    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Failed to create product",
    };
  }
}
