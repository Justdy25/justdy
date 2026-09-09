-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AIAssetType" AS ENUM ('DOCUMENT', 'IMAGE', 'VIDEO', 'AUDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AIConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."AIGenerationCreditOperation" AS ENUM ('CHAT', 'RESEARCH', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'WORKSHEET', 'QUIZ', 'LESSON_PLAN', 'PRESENTATION');

-- CreateEnum
CREATE TYPE "public"."AIGenerationOperation" AS ENUM ('CHAT', 'RESEARCH', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'WORKSHEET', 'QUIZ', 'LESSON_PLAN', 'PRESENTATION');

-- CreateEnum
CREATE TYPE "public"."AIGenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AIGenerationType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'WORKSHEET', 'WORKBOOK', 'QUIZ', 'LESSON_PLAN', 'PRESENTATION', 'STORY', 'THUMBNAIL');

-- CreateEnum
CREATE TYPE "public"."AIMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "public"."AIPlanType" AS ENUM ('FREE', 'CREATOR', 'PRO', 'STUDIO', 'SCHOOL');

-- CreateEnum
CREATE TYPE "public"."AIProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."AIProjectType" AS ENUM ('GENERAL', 'WORKSHEET', 'WORKBOOK', 'LESSON', 'QUIZ', 'VIDEO', 'STORY', 'PRESENTATION', 'YOUTUBE', 'JUSTDY_KIDZ');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('Scheduled', 'Completed', 'Cancelled', 'Pending_payment');

-- CreateEnum
CREATE TYPE "public"."AssetType" AS ENUM ('ETF', 'STOCK', 'CRYPTO', 'REAL_ESTATE', 'BOND', 'CASH_EQUIVALENT');

-- CreateEnum
CREATE TYPE "public"."ClassroomStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."CreditTransactionType" AS ENUM ('PURCHASE', 'GRANT', 'GENERATION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."CurrencyType" AS ENUM ('USD', 'GHS');

-- CreateEnum
CREATE TYPE "public"."EnrollmentStatus" AS ENUM ('Pending', 'Active', 'Cancelled');

-- CreateEnum
CREATE TYPE "public"."EnrollmentTrack" AS ENUM ('Hourly', 'Monthly');

-- CreateEnum
CREATE TYPE "public"."FamilyRole" AS ENUM ('PARENT', 'GUARDIAN', 'CHILD');

-- CreateEnum
CREATE TYPE "public"."InvestmentTransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'DRIP', 'INTEREST', 'FEE', 'TAX', 'CONTRIBUTION', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'CASH', 'HOLDING_SNAPSHOT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "public"."OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'TEACHER', 'STAFF', 'STUDENT');

-- CreateEnum
CREATE TYPE "public"."OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."OrganizationType" AS ENUM ('SCHOOL', 'DISTRICT', 'TUTORING_CENTER', 'HOMESCHOOL', 'EDUCATIONAL_INSTITUTION', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('Unpaid', 'Processing', 'Paid');

-- CreateEnum
CREATE TYPE "public"."PendingEnrollmentStatus" AS ENUM ('Pending', 'Enrolled', 'Cancelled');

-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('Free', 'FlexPay_30m', 'FlexPay_45m', 'FlexPay_60m', 'Monthly');

-- CreateEnum
CREATE TYPE "public"."ProductAccessModel" AS ENUM ('INDIVIDUAL', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('Draft', 'Pending', 'Published', 'Rejected');

-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('Course', 'Worksheets', 'Workbooks', 'Planners', 'Journals', 'Templates', 'Checklists', 'Trackers', 'Guides', 'Bundles');

-- CreateEnum
CREATE TYPE "public"."RegionType" AS ENUM ('USA', 'GHANA', 'GLOBAL');

-- CreateEnum
CREATE TYPE "public"."SlotStatus" AS ENUM ('Available', 'Booked', 'Blocked');

-- CreateEnum
CREATE TYPE "public"."StatusType" AS ENUM ('ACTIVE', 'PENDING', 'EXITED');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('Pending', 'Paid', 'Failed');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('BUY', 'SELL', 'DRIP', 'CASH');

-- CreateEnum
CREATE TYPE "public"."TutoringBookingStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'SCHEDULED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('Active', 'Suspended', 'Pending', 'Deleted');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('Pending', 'Verified', 'Rejected');

-- CreateEnum
CREATE TYPE "public"."VideoGenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."AIAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "generationId" TEXT,
    "type" "public"."AIAssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "fileKey" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "model" TEXT,
    "status" "public"."AIConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activeMessageId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "public"."AIGenerationType" NOT NULL,
    "status" "public"."AIGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT NOT NULL,
    "inputData" JSONB,
    "outputData" JSONB,
    "provider" TEXT,
    "model" TEXT,
    "providerTaskId" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creditChargedAt" TIMESTAMP(3),
    "creditOperation" "public"."AIGenerationCreditOperation",
    "creditRefundedAt" TIMESTAMP(3),
    "operation" "public"."AIGenerationOperation",
    "requestId" TEXT,

    CONSTRAINT "AIGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "metadata" JSONB,
    "generationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentMessageId" TEXT,
    "videoGenerationId" TEXT,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."AIProjectType" NOT NULL DEFAULT 'GENERAL',
    "status" "public"."AIProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "context" JSONB,

    CONSTRAINT "AIProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIRateLimitBucket" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "educatorId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "learnerDescription" TEXT,
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'Scheduled',
    "stripeCheckoutSessionId" TEXT,
    "paymentIntentId" TEXT,
    "payoutStatus" "public"."PayoutStatus" NOT NULL DEFAULT 'Unpaid',
    "videoSessionId" TEXT,
    "videoSessionToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tutoringSlotId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Chapter" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Classroom" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gradeLevel" TEXT,
    "subject" TEXT,
    "schoolYear" TEXT,
    "status" "public"."ClassroomStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassroomStudent" (
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomStudent_pkey" PRIMARY KEY ("classroomId","userId")
);

-- CreateTable
CREATE TABLE "public"."ClassroomTeacher" (
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClassroomTeacher_pkey" PRIMARY KEY ("classroomId","userId")
);

-- CreateTable
CREATE TABLE "public"."CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCreditId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "public"."CreditTransactionType" NOT NULL,
    "description" TEXT,
    "generationId" TEXT,
    "aiGenerationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Enrollment" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "public"."EnrollmentStatus" NOT NULL DEFAULT 'Pending',
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EnrollmentProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastLessonId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FacilitatorProfile" (
    "userId" TEXT NOT NULL,
    "specialty" TEXT,
    "experience" INTEGER,
    "credentialUrl" TEXT,
    "description" TEXT,
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'Pending',

    CONSTRAINT "FacilitatorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."Family" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyMember" (
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."FamilyRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("familyId","userId")
);

-- CreateTable
CREATE TABLE "public"."Investment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tickerOrSymbol" TEXT,
    "cusip" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "institution" TEXT DEFAULT 'Fidelity Investments',
    "assetClass" "public"."AssetType" NOT NULL,
    "region" "public"."RegionType" NOT NULL,
    "currency" "public"."CurrencyType" NOT NULL,
    "type" "public"."InvestmentTransactionType" NOT NULL,
    "shares" DOUBLE PRECISION,
    "pricePerShare" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "grossAmount" DOUBLE PRECISION,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBasis" DOUBLE PRECISION,
    "realizedGain" DOUBLE PRECISION,
    "marketValue" DOUBLE PRECISION,
    "unrealizedGain" DOUBLE PRECISION,
    "unrealizedGainPercent" DOUBLE PRECISION,
    "cashBalance" DOUBLE PRECISION,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "amountUSD" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "settlementDate" TIMESTAMP(3),
    "source" TEXT,
    "sourceFile" TEXT,
    "importBatchId" TEXT,
    "fingerprint" TEXT,
    "status" "public"."StatusType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvestmentAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institution" TEXT NOT NULL DEFAULT 'Fidelity Investments',
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT,
    "accountType" TEXT,
    "currency" "public"."CurrencyType" NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lesson" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailKey" TEXT,
    "videoKey" TEXT,
    "position" INTEGER NOT NULL,
    "chapterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LessonProgress" (
    "id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "public"."OrganizationType" NOT NULL DEFAULT 'SCHOOL',
    "description" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "status" "public"."OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."OrganizationRole" NOT NULL,
    "status" "public"."MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payout" (
    "id" TEXT NOT NULL,
    "educatorId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "paypalEmail" TEXT NOT NULL,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'Processing',
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PendingEnrollment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "gradeLevel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "enrollmentType" "public"."EnrollmentTrack" NOT NULL,
    "topic" TEXT,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "educatorId" TEXT,
    "amount" INTEGER NOT NULL,
    "stripeSessionId" TEXT,
    "status" "public"."PendingEnrollmentStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER,
    "printedPrice" INTEGER,
    "stripePriceId" TEXT,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."ProductType" NOT NULL,
    "status" "public"."ProductStatus" NOT NULL DEFAULT 'Draft',
    "duration" INTEGER,
    "category" TEXT,
    "imageKey" TEXT,
    "fileKey" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accessModel" "public"."ProductAccessModel" NOT NULL DEFAULT 'INDIVIDUAL',

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Paid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "public"."SitePageView" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SiteVisitor" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageViews" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gradeLevel" TEXT,
    "bio" TEXT,
    "learningStyle" TEXT,
    "preferredPace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "interval" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL,
    "planId" "public"."PlanType" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "amount" INTEGER NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TutoringBooking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "tutoringSlotId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "topic" TEXT,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "public"."TutoringBookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "stripeSessionId" TEXT,
    "paymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutoringBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TutoringSlot" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "public"."SlotStatus" NOT NULL DEFAULT 'Available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutoringSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserCredit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "public"."VideoGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "prompt" TEXT NOT NULL,
    "style" TEXT,
    "duration" INTEGER NOT NULL,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "providerTaskId" TEXT,
    "status" "public"."VideoGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "creditChargedAt" TIMESTAMP(3),
    "creditRefundedAt" TIMESTAMP(3),
    "requestId" TEXT,

    CONSTRAINT "VideoGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Whiteboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appointmentId" TEXT,
    "isStandalone" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Whiteboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT DEFAULT 'Learner',
    "imageUrl" TEXT,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'Active',
    "lastLoginAt" TIMESTAMP(3),
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'Pending',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIAsset_generationId_idx" ON "public"."AIAsset"("generationId" ASC);

-- CreateIndex
CREATE INDEX "AIAsset_projectId_idx" ON "public"."AIAsset"("projectId" ASC);

-- CreateIndex
CREATE INDEX "AIAsset_userId_createdAt_idx" ON "public"."AIAsset"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AIConversation_activeMessageId_idx" ON "public"."AIConversation"("activeMessageId" ASC);

-- CreateIndex
CREATE INDEX "AIConversation_projectId_idx" ON "public"."AIConversation"("projectId" ASC);

-- CreateIndex
CREATE INDEX "AIConversation_userId_status_idx" ON "public"."AIConversation"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "AIConversation_userId_updatedAt_idx" ON "public"."AIConversation"("userId" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "AIGeneration_operation_status_idx" ON "public"."AIGeneration"("operation" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "AIGeneration_projectId_idx" ON "public"."AIGeneration"("projectId" ASC);

-- CreateIndex
CREATE INDEX "AIGeneration_providerTaskId_idx" ON "public"."AIGeneration"("providerTaskId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AIGeneration_requestId_key" ON "public"."AIGeneration"("requestId" ASC);

-- CreateIndex
CREATE INDEX "AIGeneration_status_idx" ON "public"."AIGeneration"("status" ASC);

-- CreateIndex
CREATE INDEX "AIGeneration_userId_createdAt_idx" ON "public"."AIGeneration"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "public"."AIMessage"("conversationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AIMessage_generationId_idx" ON "public"."AIMessage"("generationId" ASC);

-- CreateIndex
CREATE INDEX "AIMessage_parentMessageId_idx" ON "public"."AIMessage"("parentMessageId" ASC);

-- CreateIndex
CREATE INDEX "AIMessage_userId_createdAt_idx" ON "public"."AIMessage"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AIMessage_videoGenerationId_idx" ON "public"."AIMessage"("videoGenerationId" ASC);

-- CreateIndex
CREATE INDEX "AIProject_userId_updatedAt_idx" ON "public"."AIProject"("userId" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AIRateLimitBucket_key_key" ON "public"."AIRateLimitBucket"("key" ASC);

-- CreateIndex
CREATE INDEX "AIRateLimitBucket_windowStart_idx" ON "public"."AIRateLimitBucket"("windowStart" ASC);

-- CreateIndex
CREATE INDEX "Appointment_educatorId_startTime_idx" ON "public"."Appointment"("educatorId" ASC, "startTime" ASC);

-- CreateIndex
CREATE INDEX "Appointment_learnerId_createdAt_idx" ON "public"."Appointment"("learnerId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Appointment_status_startTime_idx" ON "public"."Appointment"("status" ASC, "startTime" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_tutoringSlotId_key" ON "public"."Appointment"("tutoringSlotId" ASC);

-- CreateIndex
CREATE INDEX "Chapter_productId_idx" ON "public"."Chapter"("productId" ASC);

-- CreateIndex
CREATE INDEX "Classroom_organizationId_gradeLevel_idx" ON "public"."Classroom"("organizationId" ASC, "gradeLevel" ASC);

-- CreateIndex
CREATE INDEX "Classroom_organizationId_status_idx" ON "public"."Classroom"("organizationId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Classroom_organizationId_subject_idx" ON "public"."Classroom"("organizationId" ASC, "subject" ASC);

-- CreateIndex
CREATE INDEX "ClassroomStudent_userId_idx" ON "public"."ClassroomStudent"("userId" ASC);

-- CreateIndex
CREATE INDEX "ClassroomTeacher_userId_idx" ON "public"."ClassroomTeacher"("userId" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_aiGenerationId_idx" ON "public"."CreditTransaction"("aiGenerationId" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "public"."CreditTransaction"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_generationId_idx" ON "public"."CreditTransaction"("generationId" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_userCreditId_idx" ON "public"."CreditTransaction"("userCreditId" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "public"."CreditTransaction"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_productId_key" ON "public"."Enrollment"("userId" ASC, "productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentProgress_userId_productId_key" ON "public"."EnrollmentProgress"("userId" ASC, "productId" ASC);

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_role_idx" ON "public"."FamilyMember"("familyId" ASC, "role" ASC);

-- CreateIndex
CREATE INDEX "FamilyMember_userId_idx" ON "public"."FamilyMember"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Investment_fingerprint_key" ON "public"."Investment"("fingerprint" ASC);

-- CreateIndex
CREATE INDEX "Investment_userId_accountNumber_idx" ON "public"."Investment"("userId" ASC, "accountNumber" ASC);

-- CreateIndex
CREATE INDEX "Investment_userId_date_idx" ON "public"."Investment"("userId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "Investment_userId_importBatchId_idx" ON "public"."Investment"("userId" ASC, "importBatchId" ASC);

-- CreateIndex
CREATE INDEX "Investment_userId_tickerOrSymbol_idx" ON "public"."Investment"("userId" ASC, "tickerOrSymbol" ASC);

-- CreateIndex
CREATE INDEX "Investment_userId_type_idx" ON "public"."Investment"("userId" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "InvestmentAccount_userId_idx" ON "public"."InvestmentAccount"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentAccount_userId_institution_accountNumber_key" ON "public"."InvestmentAccount"("userId" ASC, "institution" ASC, "accountNumber" ASC);

-- CreateIndex
CREATE INDEX "Lesson_chapterId_idx" ON "public"."Lesson"("chapterId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "public"."LessonProgress"("userId" ASC, "lessonId" ASC);

-- CreateIndex
CREATE INDEX "Organization_ownerId_idx" ON "public"."Organization"("ownerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "public"."Organization"("slug" ASC);

-- CreateIndex
CREATE INDEX "Organization_type_status_idx" ON "public"."Organization"("type" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_role_idx" ON "public"."OrganizationMembership"("organizationId" ASC, "role" ASC);

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_status_idx" ON "public"."OrganizationMembership"("organizationId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "public"."OrganizationMembership"("organizationId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "public"."OrganizationMembership"("userId" ASC);

-- CreateIndex
CREATE INDEX "Payout_educatorId_status_idx" ON "public"."Payout"("educatorId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Payout_status_createdAt_idx" ON "public"."Payout"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PendingEnrollment_email_idx" ON "public"."PendingEnrollment"("email" ASC);

-- CreateIndex
CREATE INDEX "PendingEnrollment_status_idx" ON "public"."PendingEnrollment"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PendingEnrollment_stripeSessionId_key" ON "public"."PendingEnrollment"("stripeSessionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "public"."Permission"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "public"."Product"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Product_stripePriceId_key" ON "public"."Product"("stripePriceId" ASC);

-- CreateIndex
CREATE INDEX "Purchase_productId_idx" ON "public"."Purchase"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_stripeSessionId_productId_key" ON "public"."Purchase"("stripeSessionId" ASC, "productId" ASC);

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "public"."Purchase"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name" ASC);

-- CreateIndex
CREATE INDEX "SitePageView_createdAt_idx" ON "public"."SitePageView"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "SitePageView_path_idx" ON "public"."SitePageView"("path" ASC);

-- CreateIndex
CREATE INDEX "SitePageView_visitorId_idx" ON "public"."SitePageView"("visitorId" ASC);

-- CreateIndex
CREATE INDEX "SiteVisitor_firstSeen_idx" ON "public"."SiteVisitor"("firstSeen" ASC);

-- CreateIndex
CREATE INDEX "SiteVisitor_lastSeen_idx" ON "public"."SiteVisitor"("lastSeen" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisitor_visitorId_key" ON "public"."SiteVisitor"("visitorId" ASC);

-- CreateIndex
CREATE INDEX "StudentProfile_gradeLevel_idx" ON "public"."StudentProfile"("gradeLevel" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "public"."StudentProfile"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "public"."Subscription"("stripeSubscriptionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "public"."Subscription"("userId" ASC);

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "public"."Transaction"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TutoringBooking_appointmentId_key" ON "public"."TutoringBooking"("appointmentId" ASC);

-- CreateIndex
CREATE INDEX "TutoringBooking_customerId_createdAt_idx" ON "public"."TutoringBooking"("customerId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "TutoringBooking_status_createdAt_idx" ON "public"."TutoringBooking"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TutoringBooking_stripeSessionId_key" ON "public"."TutoringBooking"("stripeSessionId" ASC);

-- CreateIndex
CREATE INDEX "TutoringBooking_tutorId_createdAt_idx" ON "public"."TutoringBooking"("tutorId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "TutoringBooking_tutorId_status_idx" ON "public"."TutoringBooking"("tutorId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TutoringBooking_tutoringSlotId_key" ON "public"."TutoringBooking"("tutoringSlotId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TutoringSlot_tutorId_startTime_endTime_key" ON "public"."TutoringSlot"("tutorId" ASC, "startTime" ASC, "endTime" ASC);

-- CreateIndex
CREATE INDEX "TutoringSlot_tutorId_startTime_idx" ON "public"."TutoringSlot"("tutorId" ASC, "startTime" ASC);

-- CreateIndex
CREATE INDEX "TutoringSlot_tutorId_status_startTime_idx" ON "public"."TutoringSlot"("tutorId" ASC, "status" ASC, "startTime" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserCredit_userId_key" ON "public"."UserCredit"("userId" ASC);

-- CreateIndex
CREATE INDEX "VideoGeneration_providerTaskId_idx" ON "public"."VideoGeneration"("providerTaskId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VideoGeneration_requestId_key" ON "public"."VideoGeneration"("requestId" ASC);

-- CreateIndex
CREATE INDEX "VideoGeneration_status_idx" ON "public"."VideoGeneration"("status" ASC);

-- CreateIndex
CREATE INDEX "VideoGeneration_userId_createdAt_idx" ON "public"."VideoGeneration"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Whiteboard_appointmentId_key" ON "public"."Whiteboard"("appointmentId" ASC);

-- CreateIndex
CREATE INDEX "Whiteboard_userId_idx" ON "public"."Whiteboard"("userId" ASC);

-- CreateIndex
CREATE INDEX "Whiteboard_userId_isStandalone_idx" ON "public"."Whiteboard"("userId" ASC, "isStandalone" ASC);

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "public"."account"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token" ASC);

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "public"."session"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_stripeCustomerId_key" ON "public"."user"("stripeCustomerId" ASC);

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "public"."verification"("identifier" ASC);

-- AddForeignKey
ALTER TABLE "public"."AIAsset" ADD CONSTRAINT "AIAsset_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "public"."AIGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIAsset" ADD CONSTRAINT "AIAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."AIProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIAsset" ADD CONSTRAINT "AIAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIConversation" ADD CONSTRAINT "AIConversation_activeMessageId_fkey" FOREIGN KEY ("activeMessageId") REFERENCES "public"."AIMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIConversation" ADD CONSTRAINT "AIConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."AIProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIGeneration" ADD CONSTRAINT "AIGeneration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."AIProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIGeneration" ADD CONSTRAINT "AIGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIMessage" ADD CONSTRAINT "AIMessage_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "public"."AIGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIMessage" ADD CONSTRAINT "AIMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "public"."AIMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIMessage" ADD CONSTRAINT "AIMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIMessage" ADD CONSTRAINT "AIMessage_videoGenerationId_fkey" FOREIGN KEY ("videoGenerationId") REFERENCES "public"."VideoGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIProject" ADD CONSTRAINT "AIProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_tutoringSlotId_fkey" FOREIGN KEY ("tutoringSlotId") REFERENCES "public"."TutoringSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Chapter" ADD CONSTRAINT "Chapter_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Classroom" ADD CONSTRAINT "Classroom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomStudent" ADD CONSTRAINT "ClassroomStudent_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomStudent" ADD CONSTRAINT "ClassroomStudent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomTeacher" ADD CONSTRAINT "ClassroomTeacher_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomTeacher" ADD CONSTRAINT "ClassroomTeacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_aiGenerationId_fkey" FOREIGN KEY ("aiGenerationId") REFERENCES "public"."AIGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "public"."VideoGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_userCreditId_fkey" FOREIGN KEY ("userCreditId") REFERENCES "public"."UserCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Enrollment" ADD CONSTRAINT "Enrollment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnrollmentProgress" ADD CONSTRAINT "EnrollmentProgress_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnrollmentProgress" ADD CONSTRAINT "EnrollmentProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FacilitatorProfile" ADD CONSTRAINT "FacilitatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "public"."Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Investment" ADD CONSTRAINT "Investment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."InvestmentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvestmentAccount" ADD CONSTRAINT "InvestmentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lesson" ADD CONSTRAINT "Lesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "public"."Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payout" ADD CONSTRAINT "Payout_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PendingEnrollment" ADD CONSTRAINT "PendingEnrollment_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SitePageView" ADD CONSTRAINT "SitePageView_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "public"."SiteVisitor"("visitorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutoringBooking" ADD CONSTRAINT "TutoringBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutoringBooking" ADD CONSTRAINT "TutoringBooking_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutoringBooking" ADD CONSTRAINT "TutoringBooking_tutoringSlotId_fkey" FOREIGN KEY ("tutoringSlotId") REFERENCES "public"."TutoringSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutoringSlot" ADD CONSTRAINT "TutoringSlot_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserCredit" ADD CONSTRAINT "UserCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VideoGeneration" ADD CONSTRAINT "VideoGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Whiteboard" ADD CONSTRAINT "Whiteboard_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Whiteboard" ADD CONSTRAINT "Whiteboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

