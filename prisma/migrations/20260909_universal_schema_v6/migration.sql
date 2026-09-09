-- ============================================================
-- Justdy Universal Schema V6
-- Safe evolution migration
--
-- IMPORTANT:
-- - Does NOT reset the database.
-- - Does NOT delete existing application data.
-- - Existing Product rows are backfilled before NOT NULL.
-- - Existing OrganizationRole values are explicitly mapped.
-- - Existing AIGeneration creditOperation values are preserved.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. NEW ENUMS
-- ============================================================

CREATE TYPE "ConnectionStatus" AS ENUM (
  'Pending',
  'Accepted',
  'Rejected',
  'Blocked'
);

CREATE TYPE "ServiceType" AS ENUM (
  'TUTORING',
  'GROUP_CLASS',
  'COURSE',
  'CONSULTATION',
  'OTHER'
);

CREATE TYPE "ServiceStatus" AS ENUM (
  'Draft',
  'Published',
  'Archived'
);

CREATE TYPE "BookingStatus" AS ENUM (
  'Scheduled',
  'PendingPayment',
  'Completed',
  'Cancelled',
  'NoShow'
);

CREATE TYPE "CourseLevel" AS ENUM (
  'Beginner',
  'Intermediate',
  'Advanced'
);

CREATE TYPE "CourseStatus" AS ENUM (
  'Draft',
  'Published',
  'Archived'
);

CREATE TYPE "CourseEnrollmentStatus" AS ENUM (
  'Pending',
  'Active',
  'Completed',
  'Cancelled'
);

CREATE TYPE "GradeLevel" AS ENUM (
  'Grade1',
  'Grade2',
  'Grade3',
  'Grade4',
  'Grade5',
  'Grade6',
  'Grade7',
  'Grade8',
  'Grade9',
  'Grade10',
  'Grade11',
  'Grade12'
);

-- ============================================================
-- 2. SAFELY UPDATE ORGANIZATION ROLE ENUM
--
-- Old:
-- OWNER, ADMIN, TEACHER, STAFF, STUDENT
--
-- New:
-- Owner, Admin, Educator, Member
--
-- Existing values are explicitly mapped.
-- ============================================================

CREATE TYPE "OrganizationRole_new" AS ENUM (
  'Owner',
  'Admin',
  'Educator',
  'Member'
);

ALTER TABLE "OrganizationMembership"
ALTER COLUMN "role"
TYPE "OrganizationRole_new"
USING (
  CASE "role"::text
    WHEN 'OWNER' THEN 'Owner'
    WHEN 'ADMIN' THEN 'Admin'
    WHEN 'TEACHER' THEN 'Educator'
    WHEN 'STAFF' THEN 'Member'
    WHEN 'STUDENT' THEN 'Member'
    WHEN 'Owner' THEN 'Owner'
    WHEN 'Admin' THEN 'Admin'
    WHEN 'Educator' THEN 'Educator'
    WHEN 'Member' THEN 'Member'
    ELSE 'Member'
  END
)::"OrganizationRole_new";

ALTER TYPE "OrganizationRole" RENAME TO "OrganizationRole_old";

ALTER TYPE "OrganizationRole_new" RENAME TO "OrganizationRole";

DROP TYPE "OrganizationRole_old";

-- ============================================================
-- 3. AIGeneration CREDIT OPERATION
--
-- The database currently contains BOTH the old and new enum.
-- Preserve existing values while switching the column to the
-- current enum.
-- ============================================================

DROP INDEX IF EXISTS "AIGeneration_operation_status_idx";

ALTER TABLE "AIGeneration"
ALTER COLUMN "creditOperation"
TYPE "AIGenerationOperation"
USING (
  CASE
    WHEN "creditOperation" IS NULL THEN NULL
    ELSE "creditOperation"::text::"AIGenerationOperation"
  END
);

-- The old enum is no longer referenced.
DROP TYPE IF EXISTS "AIGenerationCreditOperation";

-- ============================================================
-- 4. USER CAPABILITIES
-- ============================================================

ALTER TABLE "user"
ADD COLUMN "canCreateResources" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canLearn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "canManageChildren" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canManageSchool" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canPublish" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canSell" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canTeach" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canTutor" BOOLEAN NOT NULL DEFAULT false;

-- Existing administrators who already own published products
-- should retain creator/publishing/selling capabilities.
UPDATE "user"
SET
  "canCreateResources" = true,
  "canPublish" = true,
  "canSell" = true
WHERE "role" = 'Admin';

-- ============================================================
-- 5. SUBJECTS
-- ============================================================

CREATE TABLE "Subject" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subject_name_key"
ON "Subject"("name");

-- ============================================================
-- 6. TOPICS
-- ============================================================

CREATE TABLE "Topic" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "gradeLevel" "GradeLevel" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Topic_gradeLevel_subjectId_idx"
ON "Topic"("gradeLevel", "subjectId");

CREATE INDEX "Topic_gradeLevel_subjectId_slug_idx"
ON "Topic"("gradeLevel", "subjectId", "slug");

CREATE UNIQUE INDEX "Topic_subjectId_gradeLevel_slug_key"
ON "Topic"("subjectId", "gradeLevel", "slug");

-- ============================================================
-- 7. INITIAL SUBJECT/TOPIC DATA
--
-- These are intentionally minimal and are used only to safely
-- classify the existing products during migration.
-- ============================================================

INSERT INTO "Subject" (
  "id",
  "name",
  "description",
  "updatedAt"
)
VALUES (
  'subject_mathematics',
  'Mathematics',
  'Mathematics and quantitative reasoning',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Topic" (
  "id",
  "name",
  "slug",
  "gradeLevel",
  "subjectId",
  "updatedAt"
)
SELECT
  'topic_counting_grade1',
  'Counting',
  'counting',
  'Grade1'::"GradeLevel",
  s."id",
  CURRENT_TIMESTAMP
FROM "Subject" s
WHERE s."name" = 'Mathematics'
ON CONFLICT ("subjectId", "gradeLevel", "slug") DO NOTHING;

INSERT INTO "Topic" (
  "id",
  "name",
  "slug",
  "gradeLevel",
  "subjectId",
  "updatedAt"
)
SELECT
  'topic_general_grade1',
  'General Mathematics',
  'general-mathematics',
  'Grade1'::"GradeLevel",
  s."id",
  CURRENT_TIMESTAMP
FROM "Subject" s
WHERE s."name" = 'Mathematics'
ON CONFLICT ("subjectId", "gradeLevel", "slug") DO NOTHING;

-- ============================================================
-- 8. PRODUCT CLASSIFICATION
--
-- Add nullable first.
-- Backfill.
-- Then enforce NOT NULL.
-- ============================================================

ALTER TABLE "Product"
ADD COLUMN "gradeLevel" "GradeLevel",
ADD COLUMN "subjectId" TEXT,
ADD COLUMN "topicId" TEXT;

-- Existing counting worksheets
UPDATE "Product"
SET
  "gradeLevel" = 'Grade1'::"GradeLevel",
  "subjectId" = (
    SELECT "id"
    FROM "Subject"
    WHERE "name" = 'Mathematics'
  ),
  "topicId" = (
    SELECT "id"
    FROM "Topic"
    WHERE "slug" = 'counting'
      AND "gradeLevel" = 'Grade1'::"GradeLevel"
  )
WHERE "title" ILIKE 'Counting from%';

-- Existing Grade 1 workbook
UPDATE "Product"
SET
  "gradeLevel" = 'Grade1'::"GradeLevel",
  "subjectId" = (
    SELECT "id"
    FROM "Subject"
    WHERE "name" = 'Mathematics'
  ),
  "topicId" = (
    SELECT "id"
    FROM "Topic"
    WHERE "slug" = 'general-mathematics'
      AND "gradeLevel" = 'Grade1'::"GradeLevel"
  )
WHERE "title" = 'Grade 1 Workbook';

-- Safety fallback for any other existing Product.
-- This ensures the migration cannot leave required fields NULL.
UPDATE "Product"
SET
  "gradeLevel" = COALESCE(
    "gradeLevel",
    'Grade1'::"GradeLevel"
  ),
  "subjectId" = COALESCE(
    "subjectId",
    (
      SELECT "id"
      FROM "Subject"
      WHERE "name" = 'Mathematics'
    )
  ),
  "topicId" = COALESCE(
    "topicId",
    (
      SELECT "id"
      FROM "Topic"
      WHERE "slug" = 'general-mathematics'
        AND "gradeLevel" = 'Grade1'::"GradeLevel"
    )
  )
WHERE
  "gradeLevel" IS NULL
  OR "subjectId" IS NULL
  OR "topicId" IS NULL;

-- Enforce current Prisma schema requirements.
ALTER TABLE "Product"
ALTER COLUMN "gradeLevel" SET NOT NULL,
ALTER COLUMN "subjectId" SET NOT NULL,
ALTER COLUMN "topicId" SET NOT NULL;

-- ============================================================
-- 9. CHAPTER
-- ============================================================

ALTER TABLE "Chapter"
ADD COLUMN "courseId" TEXT;

ALTER TABLE "Chapter"
ALTER COLUMN "productId" DROP NOT NULL;

CREATE INDEX "Chapter_courseId_idx"
ON "Chapter"("courseId");

-- ============================================================
-- 10. VIDEOGENERATION CLASSIFICATION
--
-- These remain nullable in the current Prisma schema, so existing
-- 18 video records require no destructive backfill.
-- ============================================================

ALTER TABLE "VideoGeneration"
ADD COLUMN "gradeLevel" "GradeLevel",
ADD COLUMN "subjectId" TEXT,
ADD COLUMN "topicId" TEXT;

CREATE INDEX "VideoGeneration_requestId_idx"
ON "VideoGeneration"("requestId");

CREATE INDEX "VideoGeneration_subjectId_idx"
ON "VideoGeneration"("subjectId");

CREATE INDEX "VideoGeneration_topicId_idx"
ON "VideoGeneration"("topicId");

-- ============================================================
-- 11. WHITEBOARD
-- ============================================================

ALTER TABLE "Whiteboard"
ADD COLUMN "bookingId" TEXT;

CREATE UNIQUE INDEX "Whiteboard_bookingId_key"
ON "Whiteboard"("bookingId");

-- ============================================================
-- 12. LEARNING PROFILE
-- ============================================================

CREATE TABLE "LearningProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gradeLevel" "GradeLevel",
  "schoolName" TEXT,
  "learningGoals" TEXT,
  "preferredSubjects" JSONB,
  "interests" JSONB,
  "preferredLanguage" TEXT,
  "timezone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LearningProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningProfile_userId_key"
ON "LearningProfile"("userId");

-- ============================================================
-- 13. TEACHING PROFILE
-- ============================================================

CREATE TABLE "TeachingProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "headline" TEXT,
  "specialty" TEXT,
  "experience" INTEGER,
  "credentialUrl" TEXT,
  "description" TEXT,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'Pending',
  "hourlyRate" INTEGER,
  "currency" "CurrencyType" NOT NULL DEFAULT 'USD',
  "subjects" JSONB,
  "gradeLevels" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeachingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingProfile_userId_key"
ON "TeachingProfile"("userId");

-- ============================================================
-- 14. CREATOR PROFILE
-- ============================================================

CREATE TABLE "CreatorProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" TEXT,
  "bio" TEXT,
  "specialties" JSONB,
  "websiteUrl" TEXT,
  "socialLinks" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreatorProfile_userId_key"
ON "CreatorProfile"("userId");

-- ============================================================
-- 15. CAPABILITIES
-- ============================================================

CREATE TABLE "Capability" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Capability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Capability_key_key"
ON "Capability"("key");

CREATE TABLE "UserCapability" (
  "userId" TEXT NOT NULL,
  "capabilityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserCapability_pkey"
  PRIMARY KEY ("userId", "capabilityId")
);

CREATE INDEX "UserCapability_capabilityId_idx"
ON "UserCapability"("capabilityId");

CREATE TABLE "UserPermission" (
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPermission_pkey"
  PRIMARY KEY ("userId", "permission")
);

CREATE INDEX "UserPermission_permission_idx"
ON "UserPermission"("permission");

-- ============================================================
-- 16. SOCIAL GRAPH
-- ============================================================

CREATE TABLE "Follow" (
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Follow_pkey"
  PRIMARY KEY ("followerId", "followingId")
);

CREATE INDEX "Follow_followingId_idx"
ON "Follow"("followingId");

CREATE TABLE "Connection" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "status" "ConnectionStatus" NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Connection_receiverId_status_idx"
ON "Connection"("receiverId", "status");

CREATE UNIQUE INDEX "Connection_requesterId_receiverId_key"
ON "Connection"("requesterId", "receiverId");

-- ============================================================
-- 17. SERVICES
-- ============================================================

CREATE TABLE "Service" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "teachingProfileId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "ServiceType" NOT NULL DEFAULT 'TUTORING',
  "durationMinutes" INTEGER,
  "price" INTEGER,
  "currency" "CurrencyType" NOT NULL DEFAULT 'USD',
  "status" "ServiceStatus" NOT NULL DEFAULT 'Draft',
  "subject" TEXT,
  "gradeLevels" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Service_providerId_status_idx"
ON "Service"("providerId", "status");

CREATE INDEX "Service_type_status_idx"
ON "Service"("type", "status");

-- ============================================================
-- 18. AVAILABILITY
-- ============================================================

CREATE TABLE "Availability" (
  "id" TEXT NOT NULL,
  "educatorId" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "status" "SlotStatus" NOT NULL DEFAULT 'Available',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Availability_educatorId_startTime_idx"
ON "Availability"("educatorId", "startTime");

CREATE INDEX "Availability_status_startTime_idx"
ON "Availability"("status", "startTime");

-- ============================================================
-- 19. UNIVERSAL BOOKINGS
-- ============================================================

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "educatorId" TEXT NOT NULL,
  "serviceId" TEXT,
  "availabilityId" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "subject" TEXT,
  "gradeLevel" TEXT,
  "status" "BookingStatus" NOT NULL DEFAULT 'Scheduled',
  "description" TEXT,
  "stripeSessionId" TEXT,
  "paymentIntentId" TEXT,
  "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'Unpaid',
  "videoSessionId" TEXT,
  "videoSessionToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Booking_studentId_startTime_idx"
ON "Booking"("studentId", "startTime");

CREATE INDEX "Booking_educatorId_startTime_idx"
ON "Booking"("educatorId", "startTime");

CREATE INDEX "Booking_status_startTime_idx"
ON "Booking"("status", "startTime");

CREATE INDEX "Booking_availabilityId_idx"
ON "Booking"("availabilityId");

-- ============================================================
-- 20. COURSES
-- ============================================================

CREATE TABLE "Course" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "smallDescription" TEXT,
  "thumbnailKey" TEXT,
  "price" INTEGER,
  "duration" INTEGER,
  "level" "CourseLevel" NOT NULL DEFAULT 'Beginner',
  "category" TEXT,
  "status" "CourseStatus" NOT NULL DEFAULT 'Draft',
  "stripePriceId" TEXT,
  "userId" TEXT NOT NULL,
  "teachingProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Course_slug_key"
ON "Course"("slug");

CREATE UNIQUE INDEX "Course_stripePriceId_key"
ON "Course"("stripePriceId");

CREATE INDEX "Course_userId_status_idx"
ON "Course"("userId", "status");

CREATE INDEX "Course_teachingProfileId_idx"
ON "Course"("teachingProfileId");

-- ============================================================
-- 21. COURSE ENROLLMENTS
-- ============================================================

CREATE TABLE "CourseEnrollment" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "amount" INTEGER,
  "status" "CourseEnrollmentStatus" NOT NULL DEFAULT 'Pending',
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseEnrollment_learnerId_status_idx"
ON "CourseEnrollment"("learnerId", "status");

CREATE UNIQUE INDEX "CourseEnrollment_courseId_learnerId_key"
ON "CourseEnrollment"("courseId", "learnerId");

-- ============================================================
-- 22. EXISTING/NEW INDEXES
-- ============================================================

CREATE INDEX "AIGeneration_userId_requestId_idx"
ON "AIGeneration"("userId", "requestId");

CREATE INDEX "Product_gradeLevel_idx"
ON "Product"("gradeLevel");

CREATE INDEX "Product_subjectId_idx"
ON "Product"("subjectId");

CREATE INDEX "Product_topicId_idx"
ON "Product"("topicId");

CREATE INDEX "Product_gradeLevel_subjectId_topicId_idx"
ON "Product"("gradeLevel", "subjectId", "topicId");

CREATE INDEX "Product_gradeLevel_subjectId_topicId_type_idx"
ON "Product"("gradeLevel", "subjectId", "topicId", "type");

-- ============================================================
-- 23. FOREIGN KEYS
-- ============================================================

ALTER TABLE "Product"
ADD CONSTRAINT "Product_subjectId_fkey"
FOREIGN KEY ("subjectId")
REFERENCES "Subject"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_topicId_fkey"
FOREIGN KEY ("topicId")
REFERENCES "Topic"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Topic"
ADD CONSTRAINT "Topic_subjectId_fkey"
FOREIGN KEY ("subjectId")
REFERENCES "Subject"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Chapter"
ADD CONSTRAINT "Chapter_courseId_fkey"
FOREIGN KEY ("courseId")
REFERENCES "Course"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Whiteboard"
ADD CONSTRAINT "Whiteboard_bookingId_fkey"
FOREIGN KEY ("bookingId")
REFERENCES "Booking"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "VideoGeneration"
ADD CONSTRAINT "VideoGeneration_subjectId_fkey"
FOREIGN KEY ("subjectId")
REFERENCES "Subject"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "VideoGeneration"
ADD CONSTRAINT "VideoGeneration_topicId_fkey"
FOREIGN KEY ("topicId")
REFERENCES "Topic"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "LearningProfile"
ADD CONSTRAINT "LearningProfile_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "TeachingProfile"
ADD CONSTRAINT "TeachingProfile_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "CreatorProfile"
ADD CONSTRAINT "CreatorProfile_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "UserCapability"
ADD CONSTRAINT "UserCapability_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "UserCapability"
ADD CONSTRAINT "UserCapability_capabilityId_fkey"
FOREIGN KEY ("capabilityId")
REFERENCES "Capability"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "UserPermission"
ADD CONSTRAINT "UserPermission_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Follow"
ADD CONSTRAINT "Follow_followerId_fkey"
FOREIGN KEY ("followerId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Follow"
ADD CONSTRAINT "Follow_followingId_fkey"
FOREIGN KEY ("followingId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Connection"
ADD CONSTRAINT "Connection_requesterId_fkey"
FOREIGN KEY ("requesterId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Connection"
ADD CONSTRAINT "Connection_receiverId_fkey"
FOREIGN KEY ("receiverId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Service"
ADD CONSTRAINT "Service_providerId_fkey"
FOREIGN KEY ("providerId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Service"
ADD CONSTRAINT "Service_teachingProfileId_fkey"
FOREIGN KEY ("teachingProfileId")
REFERENCES "TeachingProfile"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Availability"
ADD CONSTRAINT "Availability_educatorId_fkey"
FOREIGN KEY ("educatorId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_studentId_fkey"
FOREIGN KEY ("studentId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_educatorId_fkey"
FOREIGN KEY ("educatorId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_serviceId_fkey"
FOREIGN KEY ("serviceId")
REFERENCES "Service"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_availabilityId_fkey"
FOREIGN KEY ("availabilityId")
REFERENCES "Availability"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Course"
ADD CONSTRAINT "Course_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Course"
ADD CONSTRAINT "Course_teachingProfileId_fkey"
FOREIGN KEY ("teachingProfileId")
REFERENCES "TeachingProfile"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "CourseEnrollment"
ADD CONSTRAINT "CourseEnrollment_courseId_fkey"
FOREIGN KEY ("courseId")
REFERENCES "Course"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "CourseEnrollment"
ADD CONSTRAINT "CourseEnrollment_learnerId_fkey"
FOREIGN KEY ("learnerId")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

COMMIT;
