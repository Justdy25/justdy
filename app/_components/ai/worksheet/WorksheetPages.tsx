"use client";

import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";

interface WorksheetPagesProps {
  worksheet: WorksheetDocument;
}

type WorksheetQuestion = WorksheetDocument["questions"][number];

/**
 * Estimate how much vertical space a question needs.
 *
 * This is intentionally conservative. We want to prevent
 * questions from colliding with the footer.
 */
function getQuestionWeight(question: WorksheetQuestion): number {
  switch (question.type) {
    case "open_response":
      return 2.5;

    case "multiple_choice":
      return 1.35;

    case "matching":
      return 1.8;

    case "true_false":
      return 1;

    case "fill_in_blank":
      return 1;

    case "short_answer":
      return 1;

    default:
      return 1;
  }
}

/**
 * Split questions into physical worksheet pages.
 *
 * We intentionally use a weight-based pagination system rather
 * than simply saying "10 questions = 5 per page".
 *
 * That matters because an open-response question is much taller
 * than a multiple-choice question.
 */
function paginateQuestions(
  questions: WorksheetQuestion[],
): WorksheetQuestion[][] {
  const pages: WorksheetQuestion[][] = [];

  let currentPage: WorksheetQuestion[] = [];
  let currentWeight = 0;

  /*
   * Page 1 has less available space because it contains:
   *
   * - branding
   * - title
   * - student information
   * - directions
   *
   * Subsequent pages can hold more questions.
   */
  const firstPageLimit = 7;
  const regularPageLimit = 8;

  for (const question of questions) {
    const weight = getQuestionWeight(question);

    const questionLimit =
      pages.length === 0 ? firstPageLimit : regularPageLimit;

    const wouldOverflow =
      currentPage.length > 0 && currentWeight + weight > questionLimit;

    if (wouldOverflow) {
      pages.push(currentPage);

      currentPage = [];

      currentWeight = 0;
    }

    currentPage.push(question);

    currentWeight += weight;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function Question({ question }: { question: WorksheetQuestion }) {
  return (
    <div
      className="
        break-inside-avoid
        rounded-md
        py-1
      "
    >
      <div className="flex gap-2 text-[14px] font-semibold leading-6">
        <span className="font-extrabold">{question.number}.</span>

        <span className="flex-1">{question.question}</span>
      </div>

      {/* Multiple choice */}

      {question.type === "multiple_choice" && question.options && (
        <div className="mt-2 ml-8 grid grid-cols-2 gap-x-8 gap-y-2">
          {question.options.map((option, index) => (
            <div
              key={option.id}
              className="flex items-center gap-2 text-[13px] leading-5"
            >
              <span
                className="
                      flex
                      h-5
                      w-5
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-neutral-700
                      text-[9px]
                      font-bold
                    "
              >
                {String.fromCharCode(65 + index)}
              </span>

              <span>{option.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* True / False */}

      {question.type === "true_false" && (
        <div className="ml-8 mt-3 flex gap-10 text-[13px]">
          <span>○ True</span>

          <span>○ False</span>
        </div>
      )}

      {/* Short answer */}

      {(question.type === "short_answer" ||
        question.type === "fill_in_blank") && (
        <div className="ml-8 mt-3">
          <div className="border-b border-neutral-500" />
        </div>
      )}

      {/* Open response */}

      {question.type === "open_response" && (
        <div className="ml-8 mt-3 space-y-3">
          <div className="border-b border-neutral-400" />

          <div className="border-b border-neutral-400" />

          <div className="border-b border-neutral-400" />

          <div className="border-b border-neutral-400" />
        </div>
      )}

      {/* Matching */}

      {question.type === "matching" && (
        <div className="ml-8 mt-3 space-y-3">
          <div className="border-b border-neutral-400" />

          <div className="border-b border-neutral-400" />

          <div className="border-b border-neutral-400" />
        </div>
      )}
    </div>
  );
}

function PageHeader({
  worksheet,
  showTitle,
}: {
  worksheet: WorksheetDocument;
  showTitle: boolean;
}) {
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
          Justdy Learning
        </div>

        <div className="text-[10px] font-bold">{worksheet.gradeLevel}</div>
      </div>

      {showTitle ? (
        <>
          <div className="mx-auto mb-5 max-w-[90%] rounded-lg border-2 border-black px-6 py-4 text-center">
            <h1 className="text-[22px] font-extrabold uppercase leading-tight">
              {worksheet.title}
            </h1>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
              {worksheet.subject}
            </p>
          </div>

          <div className="mb-5 flex items-center gap-6 text-[12px]">
            <div className="flex-1">
              <span className="font-bold">Name:</span>

              <span className="ml-2 inline-block w-52 border-b border-black" />
            </div>

            <div>
              <span className="font-bold">Date:</span>

              <span className="ml-2 inline-block w-24 border-b border-black" />
            </div>

            <div>
              <span className="font-bold">Score:</span>

              <span className="ml-2 inline-block w-16 border-b border-black" />
            </div>
          </div>

          <div className="mb-6 rounded-md border border-neutral-400 px-4 py-3 text-[12px] leading-5">
            <span className="mr-1 font-extrabold">Directions:</span>

            {worksheet.instructions}
          </div>
        </>
      ) : (
        <div className="mb-5 border-b border-neutral-300 pb-3">
          <h2 className="text-sm font-extrabold uppercase">
            {worksheet.title}
          </h2>

          <p className="mt-0.5 text-[9px] font-semibold uppercase text-neutral-500">
            {worksheet.subject}
          </p>
        </div>
      )}
    </>
  );
}

function PageFooter({
  worksheet,
  pageNumber,
  totalPages,
}: {
  worksheet: WorksheetDocument;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <div
      className="
        absolute
        bottom-[0.31in]
        left-[0.62in]
        right-[0.62in]
        flex
        items-center
        justify-between
        border-t
        border-neutral-200
        pt-2
        text-[8px]
        text-neutral-500
      "
    >
      <span className="font-bold">
        Justdy Learning • {worksheet.gradeLevel}
      </span>

      <span>
        Page {pageNumber} of {totalPages}
      </span>
    </div>
  );
}

export default function WorksheetPages({ worksheet }: WorksheetPagesProps) {
  const pages = paginateQuestions(worksheet.questions);

  return (
    <div className="flex flex-col items-center gap-8">
      {pages.map((questions, pageIndex) => {
        const pageNumber = pageIndex + 1;

        const isFirstPage = pageIndex === 0;

        return (
          <div
            key={`worksheet-page-${pageNumber}`}
            className="
                relative
                h-[1056px]
                w-[816px]
                shrink-0
                overflow-hidden
                bg-white
                text-black
                shadow-xl
              "
          >
            {/* Physical page border */}

            <div
              className="
                  pointer-events-none
                  absolute
                  inset-6
                  rounded-xl
                  border-2
                  border-black
                "
            />

            {/* Page content */}

            <div
              className="
                  relative
                  h-full
                  px-[60px]
                  pb-[70px]
                  pt-[54px]
                "
            >
              <PageHeader worksheet={worksheet} showTitle={isFirstPage} />

              <main
                className="
                    space-y-4
                  "
              >
                {questions.map((question) => (
                  <Question key={question.id} question={question} />
                ))}
              </main>

              <PageFooter
                worksheet={worksheet}
                pageNumber={pageNumber}
                totalPages={pages.length}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
