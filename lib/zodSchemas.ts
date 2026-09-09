import { z } from "zod";

/* ============================================================
   PRODUCT STATUS
============================================================ */

export const productStatus = [
  "Draft",
  "Published",
  "Rejected",
  "Pending",
] as const;

/* ============================================================
   PRODUCT TYPES
============================================================ */

export const productType = [
  "Course",
  "Worksheets",
  "Workbooks",
  "Planners",
  "Journals",
  "Templates",
  "Checklists",
  "Trackers",
  "Guides",
  "Bundles",
] as const;

/* ============================================================
   GRADE LEVELS
============================================================ */

/* ============================================================
   SUBJECTS
============================================================ */

export const subjects = [
  "Mathematics",
  "Writing",
  "Reading",
  "Science",
  "Social Studies",
  "English",
] as const;

/* ============================================================
   COURSE CATEGORIES
============================================================ */

export const courseCategories = ["Mathematics", "Writing", "Reading"] as const;

/* ============================================================
   AUTH
============================================================ */

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),

  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = z
  .object({
    name: z.string().min(2, "Name is required"),

    email: z.string().email("Invalid email"),

    password: z.string().min(8, "Password must be at least 8 characters"),

    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/* ============================================================
   PRODUCT
============================================================ */

export const productSchema = z.object({
  /* ==========================================================
     BASIC INFORMATION
  ========================================================== */

  title: z
    .string()
    .min(3, {
      message: "Title must be at least 3 characters long",
    })
    .max(100, {
      message: "Title must be at most 100 characters long",
    }),

  description: z.string().min(3, {
    message: "Description must be at least 3 characters long",
  }),

  slug: z.string().min(3, {
    message: "Slug must be at least 3 characters long",
  }),

  /* ==========================================================
     PRODUCT TYPE
  ========================================================== */

  type: z.enum(productType, {
    message: "Type is required",
  }),

  /* ==========================================================
     ACADEMIC CLASSIFICATION
     
     These are DATABASE RELATION IDs.
     
     Example:
     
     gradeLevel = Grade1
     subjectId  = "cm..."
     topicId    = "cm..."
  ========================================================== */

  /* ==========================================================
     DIGITAL PRICE
     
     Optional here because worksheets do not have
     an individual price.
     
     The SERVER determines whether price is required.
  ========================================================== */

  price: z.coerce.number().nonnegative().optional().nullable(),

  /* ==========================================================
     PRINTED PRICE
     
     Only used for Workbooks.
  ========================================================== */

  printedPrice: z.coerce.number().nonnegative().optional().nullable(),

  /* ==========================================================
     STATUS
     
     The server will create new products as Draft.
  ========================================================== */

  status: z.enum(productStatus, {
    message: "Status is required",
  }),

  /* ==========================================================
     DIGITAL FILE
  ========================================================== */

  fileKey: z.string().optional(),

  /* ==========================================================
     COURSE INFORMATION
  ========================================================== */

  duration: z.coerce.number().positive().optional().nullable(),

  category: z.enum(courseCategories).optional().or(z.literal("")),
});

/* ============================================================
   CHAPTER
============================================================ */

export const chapterSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters long",
  }),

  productId: z.string(),
});

/* ============================================================
   LESSON
============================================================ */

export const lessonSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters long",
  }),

  productId: z.string().min(1, {
    message: "Invalid product id",
  }),

  chapterId: z.string().min(1, {
    message: "Invalid chapter id",
  }),

  description: z
    .string()
    .min(3, {
      message: "Description must be at least 3 characters long",
    })
    .optional(),

  thumbnailKey: z.string().optional(),

  videoKey: z.string().optional(),
});

/* ============================================================
   SETTINGS
============================================================ */

export const settingsSchema = z.object({
  fullName: z.string().min(3).max(150),

  profileImage: z.string(),
});

/* ============================================================
   EDUCATOR
============================================================ */

export const educatorSchema = z.object({
  specialty: z.string().min(1, {
    message: "Specialty is required",
  }),

  experience: z.number().min(1, {
    message: "Experience must be a non-negative number",
  }),

  credentialUrl: z.string().url(),

  description: z.string().min(3).max(500),
});

/* ============================================================
   SUBJECT
============================================================ */

export const subjectSchema = z.object({
  name: z.string().min(1, "Subject name is required"),

  description: z.string().optional().nullable(),
});

/* ============================================================
   TOPIC
============================================================ */

export const topicSchema = z.object({
  name: z
    .string()
    .min(1, "Topic name is required")
    .max(150, "Topic name is too long"),

  description: z.string().optional().nullable(),

  slug: z.string().min(1, "Topic slug is required"),
});

/* ============================================================
   SUBJECT
============================================================ */

export const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Subject name must be at least 2 characters")
    .max(100, "Subject name is too long"),

  description: z
    .string()
    .trim()
    .max(500, "Description is too long")
    .optional()
    .or(z.literal("")),
});

export const updateSubjectSchema = z.object({
  id: z.string().min(1, "Invalid subject ID"),

  name: z
    .string()
    .trim()
    .min(2, "Subject name must be at least 2 characters")
    .max(100, "Subject name is too long"),

  description: z
    .string()
    .trim()
    .max(500, "Description is too long")
    .optional()
    .or(z.literal("")),
});

/* ============================================================
   TOPIC
============================================================ */

export const createTopicSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Topic name must be at least 2 characters")
    .max(150, "Topic name is too long"),

  description: z
    .string()
    .trim()
    .max(500, "Description is too long")
    .optional()
    .or(z.literal("")),
});

export const updateTopicSchema = z.object({
  id: z.string().min(1, "Invalid topic ID"),

  name: z
    .string()
    .trim()
    .min(2, "Topic name must be at least 2 characters")
    .max(150, "Topic name is too long"),

  description: z
    .string()
    .trim()
    .max(500, "Description is too long")
    .optional()
    .or(z.literal("")),
});

/* ============================================================
   TYPES
============================================================ */

export type CreateSubjectSchemaType = z.infer<typeof createSubjectSchema>;

export type UpdateSubjectSchemaType = z.infer<typeof updateSubjectSchema>;

export type CreateTopicSchemaType = z.infer<typeof createTopicSchema>;

export type UpdateTopicSchemaType = z.infer<typeof updateTopicSchema>;

/* ============================================================
   PACKAGES
============================================================ */

export const packagesSchema = z.object({
  name: z.string().min(1, "Package name is required"),

  description: z.string().optional().nullable(),

  targetGrades: z.string().min(1, "Target grades are required"),

  price: z.coerce.number().min(1, {
    message: "Price must be a positive number",
  }),

  subjectId: z.string().min(1, "Subject is required"),
});

/* ============================================================
   TYPES
============================================================ */

export type ProductSchemaType = z.output<typeof productSchema>;

export type ChapterSchemaType = z.infer<typeof chapterSchema>;

export type LessonSchemaType = z.infer<typeof lessonSchema>;

export type SettingsSchemaType = z.infer<typeof settingsSchema>;

export type EducatorSchemaType = z.infer<typeof educatorSchema>;

export type SubjectSchemaType = z.infer<typeof subjectSchema>;

export type TopicSchemaType = z.infer<typeof topicSchema>;

export type PackagesSchemaType = z.infer<typeof packagesSchema>;
