import "server-only";

import Link from "next/link";
import { ResourcePreviewCard } from "@/app/_components/ResourcePreviewCard";
import { GetAllPublishedProducts } from "@/app/actions/manage-get-all-products";
import { PdfPreview } from "@/app/_components/PdfPreview";
import SubjectFilters from "@/app/_components/SubjectFilters";
import { ProductType } from "@/lib/generated/prisma/enums";
import prisma from "@/lib/prisma";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    type?: string;
    search?: string;
    subjectId?: string;
    topicId?: string;
    gradeLevel?: string;
  }>;
}

interface TopicOption {
  id: string;
  name: string;
  slug: string;
  gradeLevel: string;
  subjectId: string;
}

interface ProductFileInfo {
  fileKey: string | null;
  fileType: string | null;
}

const SUBJECT_COLORS = [
  {
    accent: "bg-lime-500",
    soft: "bg-lime-50",
    text: "text-lime-700",
    border: "border-lime-200",
  },
  {
    accent: "bg-cyan-500",
    soft: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
  },
  {
    accent: "bg-orange-500",
    soft: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
  },
  {
    accent: "bg-violet-500",
    soft: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
  },
  {
    accent: "bg-pink-500",
    soft: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
  },
  {
    accent: "bg-blue-500",
    soft: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
];

/* ============================================================
   HELPERS
============================================================ */

function getGradeNumber(value: string) {
  const match = String(value).match(/\d+/);

  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function formatGradeLabel(value?: string) {
  if (!value) return "All grades";

  const normalized = String(value).replace(/[_-]/g, " ").trim();

  const match = normalized.match(/^grade\s*(\d+)$/i);

  if (match) {
    return `Grade ${match[1]}`;
  }

  if (/^\d+$/.test(normalized)) {
    return `Grade ${normalized}`;
  }

  return normalized.replace(/^grade\s+/i, "Grade ");
}

function getResourceLabel(type?: unknown) {
  if (!type) return "Resource";

  const value = String(type).toLowerCase();

  if (value.includes("course")) {
    return "Course";
  }

  if (value.includes("workbook")) {
    return "Workbook";
  }

  if (value.includes("worksheet")) {
    return "Worksheet";
  }

  if (value.includes("digital") || value.includes("product")) {
    return "Digital product";
  }

  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getProductField(product: unknown, keys: string[]) {
  const value = product as Record<string, unknown>;

  for (const key of keys) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

/* ============================================================
   STRIP HTML FROM DESCRIPTION
============================================================ */

function stripHtml(value?: string) {
  if (!value) return "";

  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getProductTitle(product: unknown) {
  return (
    getProductField(product, ["title", "name", "productName"]) ||
    "Learning Resource"
  );
}

function getProductDescription(product: unknown) {
  return (
    getProductField(product, [
      "description",
      "shortDescription",
      "summary",
      "excerpt",
    ]) ||
    "A carefully designed learning resource to support practice, understanding, and confident learning."
  );
}

function getProductImageUrl(product: unknown) {
  return getProductField(product, [
    "imageUrl",
    "imageURL",
    "thumbnailUrl",
    "thumbnailURL",
    "coverImage",
    "coverImageUrl",
    "featuredImage",
    "featuredImageUrl",
    "image",
  ]);
}

/* ============================================================
   PDF DETECTION
============================================================ */

function isPdfFile(fileType?: string | null, fileKey?: string | null) {
  const normalizedType = String(fileType ?? "").toLowerCase();

  const normalizedKey = String(fileKey ?? "").toLowerCase();

  return (
    normalizedType.includes("pdf") ||
    normalizedKey.endsWith(".pdf") ||
    normalizedKey.includes(".pdf?")
  );
}

/* ============================================================
   RESOURCE ICON
============================================================ */

function ResourcePreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden="true">
      <path
        d="M6 3.75h8.5L19 8.25V20a.75.75 0 0 1-.75.75h-11.5A.75.75 0 0 1 6 20V3.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path d="M14 3.75V8.5h4.75" stroke="currentColor" strokeWidth="1.7" />

      <path
        d="M8.75 13h6.5M8.75 16h4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ============================================================
   PAGE
============================================================ */

export default async function PublicProductsRoute({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;

  const searchQuery = resolvedSearchParams.search?.trim() || undefined;

  const currentSubjectId = resolvedSearchParams.subjectId?.trim() || undefined;

  const requestedTopicId = resolvedSearchParams.topicId?.trim() || undefined;

  const requestedGradeLevel =
    resolvedSearchParams.gradeLevel?.trim() || undefined;

  const currentType =
    resolvedSearchParams.type &&
    Object.values(ProductType).includes(
      resolvedSearchParams.type as ProductType,
    )
      ? (resolvedSearchParams.type as ProductType)
      : undefined;

  /* ==========================================================
     SUBJECT
  ========================================================== */

  const subject = currentSubjectId
    ? await prisma.subject.findUnique({
        where: {
          id: currentSubjectId,
        },
        select: {
          id: true,
          name: true,
        },
      })
    : null;

  /* ==========================================================
     TOPICS
  ========================================================== */

  const subjectTopics: TopicOption[] = subject
    ? (
        await prisma.topic.findMany({
          where: {
            subjectId: subject.id,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            gradeLevel: true,
            subjectId: true,
          },
        })
      ).map((topic) => ({
        ...topic,
        gradeLevel: String(topic.gradeLevel),
      }))
    : [];

  const gradeLevels = Array.from(
    new Set(subjectTopics.map((topic) => topic.gradeLevel)),
  ).sort((a, b) => getGradeNumber(a) - getGradeNumber(b));

  const activeTopic = subjectTopics.find(
    (topic) => topic.id === requestedTopicId,
  );

  const activeGradeLevel = activeTopic?.gradeLevel || requestedGradeLevel;

  const visibleTopics = subjectTopics
    .filter(
      (topic) => !activeGradeLevel || topic.gradeLevel === activeGradeLevel,
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  /* ==========================================================
     PRODUCTS
  ========================================================== */

  const productsFromAction =
    currentType || searchQuery
      ? await GetAllPublishedProducts(currentType, searchQuery)
      : await GetAllPublishedProducts();

  let filteredProducts = productsFromAction;

  /* ==========================================================
     SUBJECT / TOPIC FILTER
  ========================================================== */

  if (subject) {
    let matchingTopicIds = subjectTopics.map((topic) => topic.id);

    if (activeGradeLevel) {
      matchingTopicIds = subjectTopics
        .filter((topic) => topic.gradeLevel === activeGradeLevel)
        .map((topic) => topic.id);
    }

    if (activeTopic) {
      matchingTopicIds = [activeTopic.id];
    }

    const allowedProductRows =
      matchingTopicIds.length > 0
        ? await prisma.product.findMany({
            where: {
              status: "Published",
              topicId: {
                in: matchingTopicIds,
              },
            },
            select: {
              id: true,
            },
          })
        : [];

    const allowedProductIds = new Set(
      allowedProductRows.map((product) => product.id),
    );

    filteredProducts = productsFromAction.filter((product) =>
      allowedProductIds.has(product.id),
    );
  }

  /* ==========================================================
     GET PDF FILE INFORMATION
     
     fileKey/fileType are fetched directly from Prisma
     so the preview does not depend on optional URL fields.
  ========================================================== */

  const productIds = filteredProducts.map((product) => product.id);

  const productFileRows =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
          select: {
            id: true,
            fileKey: true,
            fileType: true,
          },
        })
      : [];

  const productFiles = new Map<string, ProductFileInfo>(
    productFileRows.map((product) => [
      product.id,
      {
        fileKey: product.fileKey,
        fileType: product.fileType,
      },
    ]),
  );

  /* ==========================================================
     SUBJECT COLOR
  ========================================================== */

  const subjectIndex = subject
    ? Math.max(
        0,
        (
          await prisma.subject.findMany({
            select: {
              id: true,
            },
            orderBy: {
              name: "asc",
            },
          })
        ).findIndex((item) => item.id === subject.id),
      )
    : 0;

  const colors = SUBJECT_COLORS[subjectIndex % SUBJECT_COLORS.length];

  const hasFilters = Boolean(
    searchQuery || currentType || activeGradeLevel || activeTopic,
  );

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <main className="min-h-screen bg-slate-50/60">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {/* ====================================================
            SUBJECT HEADER
        ==================================================== */}

        {subject ? (
          <header className="relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.06)]">
            <div className={`absolute inset-x-0 top-0 h-1 ${colors.accent}`} />

            <div
              className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full ${colors.soft}`}
            />

            <div
              className={`pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full ${colors.soft} opacity-60`}
            />

            <div className="relative px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
              <Link
                href="/"
                className="absolute left-5 top-8 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition-colors hover:text-slate-700 sm:left-8 sm:top-10 lg:left-10"
              >
                <ArrowLeft />
                Go Back
              </Link>

              <div className="flex justify-center text-center">
                <div className="max-w-4xl">
                  <h1 className="text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl lg:text-5xl">
                    {subject.name}
                  </h1>

                  <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base">
                    Explore all {subject.name} learning resources. Filter by
                    grade level or topic.
                  </p>
                </div>
              </div>
            </div>
          </header>
        ) : (
          <header className="mb-6 rounded-[28px] border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Learning resources
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Explore our resources
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Browse worksheets, workbooks, courses, activities, and other
              learning resources.
            </p>
          </header>
        )}

        {/* ====================================================
            FILTERS
        ==================================================== */}

        {subject && (
          <SubjectFilters
            subjectId={subject.id}
            gradeLevels={gradeLevels}
            activeGradeLevel={activeGradeLevel}
            visibleTopics={visibleTopics}
            activeTopicId={activeTopic?.id}
            activeTopicName={activeTopic?.name}
            currentType={currentType ? String(currentType) : undefined}
            searchQuery={searchQuery}
            colors={colors}
            hasFilters={hasFilters}
          />
        )}

        {/* ====================================================
            RESOURCE HEADER
        ==================================================== */}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="mx-auto mt-0 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base">
              {activeTopic
                ? activeTopic.name
                : activeGradeLevel
                  ? `${formatGradeLabel(activeGradeLevel)} resources`
                  : subject
                    ? `All ${subject.name} resources`
                    : "Explore resources"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "item" : "items"}
            </span>

            {hasFilters && (
              <Link
                href={
                  subject
                    ? `/products?subjectId=${encodeURIComponent(subject.id)}`
                    : "/products"
                }
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-800"
              >
                Clear filters
              </Link>
            )}
          </div>
        </div>

        {/* ====================================================
            SEARCH MESSAGE
        ==================================================== */}

        {searchQuery && (
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Showing results for{" "}
            <span className="font-black">“{searchQuery}”</span>
          </div>
        )}

        {/* ====================================================
            PRODUCTS
        ==================================================== */}

        <RenderProducts
          products={filteredProducts}
          productFiles={productFiles}
          colors={colors}
          searchQuery={searchQuery}
        />
      </section>
    </main>
  );
}

/* ============================================================
   PRODUCTS
============================================================ */

function RenderProducts({
  products,
  productFiles,
  colors,
  searchQuery,
}: {
  products: Awaited<ReturnType<typeof GetAllPublishedProducts>>;

  productFiles: Map<string, ProductFileInfo>;

  colors: (typeof SUBJECT_COLORS)[number];

  searchQuery?: string;
}) {
  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  if (!products || products.length === 0) {
    return (
      <div className="mt-10 rounded-md border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${colors.soft} ${colors.text}`}
        >
          <ResourcePreviewIcon />
        </div>

        <h3 className="mt-5 text-lg font-black text-slate-900">
          No resources found
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {searchQuery
            ? `We couldn't find any resources matching "${searchQuery}".`
            : "There are no published resources for the selected filters yet."}
        </p>
      </div>
    );
  }

  /* ==========================================================
     GRID
  ========================================================== */

  return (
    <div className="mt-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => {
          /* ====================================================
             PRODUCT DATA
          ==================================================== */

          const imageUrl = getProductImageUrl(product);

          const title = getProductTitle(product);

          const description = stripHtml(getProductDescription(product));

          const type = getResourceLabel(
            (product as Record<string, unknown>).type,
          );

          /* ====================================================
             FILE INFORMATION
          ==================================================== */

          const fileInfo = productFiles.get(product.id);

          const fileKey = fileInfo?.fileKey ?? null;

          const fileType = fileInfo?.fileType ?? null;

          const isPdf = isPdfFile(fileType, fileKey);

          /*
           * Public PDF preview route.
           */
          const pdfPreviewUrl = isPdf
            ? `/api/products/${product.id}/preview`
            : null;

          return (
            <ResourcePreviewCard
              key={product.id}
              title={title}
              description={description}
              type={type}
              isPdf={isPdf}
              pdfPreviewUrl={pdfPreviewUrl}
              imageUrl={imageUrl || undefined}
              accentClass={colors.accent}
              softClass={colors.soft}
            />
          );
        })}
      </div>
    </div>
  );
}
