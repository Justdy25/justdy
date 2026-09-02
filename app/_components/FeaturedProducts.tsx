import "server-only";

import prisma from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

/* ============================================================
   TYPES
============================================================ */

type SubjectCard = {
  id: string;
  name: string;
  grades: string[];
};

/* ============================================================
   SUBJECT STYLES

   KEEPING YOUR EXISTING COLORS
============================================================ */

const subjectStyles = [
  {
    accent: "bg-lime-400",
    accentText: "text-lime-500",
    border: "border-lime-400/30",
    soft: "bg-lime-50",
    ring: "ring-lime-400/20",
  },
  {
    accent: "bg-cyan-400",
    accentText: "text-cyan-500",
    border: "border-cyan-400/30",
    soft: "bg-cyan-50",
    ring: "ring-cyan-400/20",
  },
  {
    accent: "bg-orange-400",
    accentText: "text-orange-500",
    border: "border-orange-400/30",
    soft: "bg-orange-50",
    ring: "ring-orange-400/20",
  },
  {
    accent: "bg-violet-400",
    accentText: "text-violet-500",
    border: "border-violet-400/30",
    soft: "bg-violet-50",
    ring: "ring-violet-400/20",
  },
  {
    accent: "bg-pink-400",
    accentText: "text-pink-500",
    border: "border-pink-400/30",
    soft: "bg-pink-50",
    ring: "ring-pink-400/20",
  },
  {
    accent: "bg-yellow-300",
    accentText: "text-yellow-500",
    border: "border-yellow-300/30",
    soft: "bg-yellow-50",
    ring: "ring-yellow-300/20",
  },
];

/* ============================================================
   FORMAT GRADE LABEL
============================================================ */

function formatGradeLabel(grade: string) {
  return grade.replace(/^Grade/, "Grade ");
}

/* ============================================================
   GET NUMERIC GRADE VALUE
============================================================ */

function getGradeNumber(grade: string) {
  const match = grade.match(/\d+/);

  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

/* ============================================================
   COMPONENT
============================================================ */

export default async function FeaturedProducts() {
  const subjects = await prisma.subject.findMany({
    select: {
      id: true,
      name: true,

      topics: {
        select: {
          gradeLevel: true,
        },
      },
    },

    orderBy: {
      name: "asc",
    },
  });

  /* ============================================================
     PREPARE SUBJECT CARDS
  ============================================================ */

  const subjectCards: SubjectCard[] = subjects.map((subject) => {
    const grades = Array.from(
      new Set(subject.topics.map((topic) => String(topic.gradeLevel))),
    ).sort((a, b) => getGradeNumber(a) - getGradeNumber(b));

    return {
      id: subject.id,
      name: subject.name,
      grades,
    };
  });

  /* ============================================================
     EMPTY STATE
  ============================================================ */

  if (subjectCards.length === 0) {
    return (
      <section className="bg-background py-12 pb-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-12">
          <div
            className="
              mx-auto
              max-w-2xl
              rounded-md
              border
              border-slate-200
              bg-white
              px-6
              py-16
              text-center
              shadow-sm
            "
          >
            <div
              className="
                mx-auto
                mb-5
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-2xl
                bg-slate-100
                text-xl
                text-slate-500
              "
            >
              📚
            </div>

            <h3 className="text-xl font-bold text-slate-900">
              No subjects available yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Learning resources will appear here once subjects and topics have
              been added.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <section className="bg-background py-10 pb-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-12">
        {/* ======================================================
            SECTION HEADER
        ====================================================== */}

        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <div className="h-1 w-8 rounded-full bg-blue-500" />

            <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-500">
              Explore & Learn
            </span>

            <div className="h-1 w-8 rounded-full bg-blue-500" />
          </div>

          <div className="flex flex-col items-center">
            <div>
              <h2
                className="
          text-3xl
          font-bold
          tracking-tight
          text-slate-950
          sm:text-4xl
        "
              >
                Resources for Every Learner
              </h2>

              <p
                className="
          mx-auto
          mt-3
          max-w-2xl
          text-sm
          leading-6
          text-slate-500
          sm:text-base
        "
              >
                Explore carefully curated worksheets, workbooks, activities, and
                learning resources designed to make learning easier, more
                engaging, and more effective.
              </p>
            </div>
          </div>
        </div>

        {/* ============================================================
            SUBJECT + WORKBOOK CARDS
        ============================================================ */}

        <div
          className="
            grid
            grid-cols-1
            gap-6
            sm:grid-cols-2
            lg:grid-cols-3
          "
        >
          {/* ==========================================================
              DYNAMIC SUBJECT CARDS
          ========================================================== */}

          {subjectCards.map((subject, index) => {
            const style = subjectStyles[index % subjectStyles.length];

            const visibleGrades = subject.grades.slice(0, 5);

            const remainingGrades = Math.max(
              subject.grades.length - visibleGrades.length,
              0,
            );

            return (
              <Link
                key={subject.id}
                href={`/products?subjectId=${encodeURIComponent(subject.id)}`}
                className="
                  group
                  relative
                  flex
                  min-h-90
                  flex-col
                  overflow-hidden
                  rounded-md
                  border
                  border-slate-200
                  bg-white
                  shadow-[0_8px_30px_rgba(15,23,42,0.06)]
                  transition-all
                  duration-300
                  hover:-translate-y-1.5
                  hover:border-slate-300
                  hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)]
                "
              >
                {/* ==================================================
                    TOP ACCENT LINE
                ================================================== */}

                <div
                  className={`
                    absolute
                    left-0
                    right-0
                    top-0
                    h-1.5
                    ${style.accent}
                    transition-all
                    duration-300
                    group-hover:h-2
                  `}
                />

                {/* ==================================================
                    HEADER AREA
                ================================================== */}

                <div className="relative px-7 pb-6 pt-8">
                  {/* ------------------------------------------------
                      DECORATIVE BACKGROUND
                  ------------------------------------------------ */}

                  <div
                    className={`
                      pointer-events-none
                      absolute
                      -right-12
                      -top-12
                      h-36
                      w-36
                      rounded-full
                      ${style.soft}
                      opacity-70
                      transition-transform
                      duration-500
                      group-hover:scale-125
                    `}
                  />

                  <div
                    className={`
                      pointer-events-none
                      absolute
                      right-16
                      top-12
                      h-2
                      w-2
                      rounded-full
                      ${style.accent}
                      opacity-60
                    `}
                  />

                  <div
                    className={`
                      pointer-events-none
                      absolute
                      right-24
                      top-20
                      h-1.5
                      w-1.5
                      rounded-full
                      ${style.accent}
                      opacity-40
                    `}
                  />

                  {/* ------------------------------------------------
                      SUBJECT ICON
                  ------------------------------------------------ */}

                  <div className="relative mb-7 flex items-center justify-between">
                    <div
                      className={`
      flex
      h-12
      w-12
      items-center
      justify-center
      rounded-2xl
      ${style.soft}
      ring-1
      ${style.ring}
      transition-all
      duration-300
      group-hover:scale-105
    `}
                    >
                      {/* Subject-specific icon */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`h-6 w-6 ${style.accentText}`}
                        aria-hidden="true"
                      >
                        {(() => {
                          const subjectName = subject.name.toLowerCase();

                          /* ==========================================================
           MATHEMATICS
        ========================================================== */

                          if (
                            subjectName.includes("math") ||
                            subjectName.includes("algebra") ||
                            subjectName.includes("geometry") ||
                            subjectName.includes("calculus")
                          ) {
                            return (
                              <>
                                <rect
                                  x="4"
                                  y="3"
                                  width="16"
                                  height="18"
                                  rx="2.5"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                />
                                <path
                                  d="M8 7h8"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           SCIENCE
        ========================================================== */

                          if (
                            subjectName.includes("science") ||
                            subjectName.includes("biology") ||
                            subjectName.includes("chemistry") ||
                            subjectName.includes("physics")
                          ) {
                            return (
                              <>
                                <path
                                  d="M9 3v6.5L5.5 16a3.5 3.5 0 0 0 3.05 5h6.9a3.5 3.5 0 0 0 3.05-5L15 9.5V3"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M8 14h8"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M7 3h4M13 3h4"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           ENGLISH / LANGUAGE ARTS
        ========================================================== */

                          if (
                            subjectName.includes("english") ||
                            subjectName.includes("language arts") ||
                            subjectName.includes("grammar") ||
                            subjectName.includes("writing")
                          ) {
                            return (
                              <>
                                <path
                                  d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21V4.5Z"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M5 17.5A2.5 2.5 0 0 1 7.5 15H19"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M9 6h6M9 9h5"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           READING
        ========================================================== */

                          if (
                            subjectName.includes("reading") ||
                            subjectName.includes("literature")
                          ) {
                            return (
                              <>
                                <path
                                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M7 7h2M7 10h2M15 7h2M15 10h2"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           HISTORY / SOCIAL STUDIES
        ========================================================== */

                          if (
                            subjectName.includes("history") ||
                            subjectName.includes("social studies") ||
                            subjectName.includes("civics") ||
                            subjectName.includes("government")
                          ) {
                            return (
                              <>
                                <path
                                  d="M4 20h16"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M5 20V10h14v10"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M3 10l9-6 9 6H3Z"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M8 13v4M12 13v4M16 13v4"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           GEOGRAPHY
        ========================================================== */

                          if (
                            subjectName.includes("geography") ||
                            subjectName.includes("world")
                          ) {
                            return (
                              <>
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="8.5"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                />
                                <path
                                  d="M3.8 12h16.4M12 3.5c2.2 2.35 3.3 5.2 3.3 8.5S14.2 18.15 12 20.5c-2.2-2.35-3.3-5.2-3.3-8.5S9.8 5.85 12 3.5Z"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           ART
        ========================================================== */

                          if (
                            subjectName.includes("art") ||
                            subjectName.includes("drawing") ||
                            subjectName.includes("painting")
                          ) {
                            return (
                              <>
                                <path
                                  d="M12 4a8 8 0 1 0 0 16h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h2a6 6 0 0 0-2-8Z"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                                <circle
                                  cx="7.5"
                                  cy="10"
                                  r="1"
                                  fill="currentColor"
                                />
                                <circle
                                  cx="10"
                                  cy="7"
                                  r="1"
                                  fill="currentColor"
                                />
                                <circle
                                  cx="14"
                                  cy="7"
                                  r="1"
                                  fill="currentColor"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           MUSIC
        ========================================================== */

                          if (
                            subjectName.includes("music") ||
                            subjectName.includes("band")
                          ) {
                            return (
                              <>
                                <path
                                  d="M9 18V5l10-2v13"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M9 8l10-2"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                />
                                <ellipse
                                  cx="6.5"
                                  cy="18"
                                  rx="2.5"
                                  ry="2"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                />
                                <ellipse
                                  cx="16.5"
                                  cy="16"
                                  rx="2.5"
                                  ry="2"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           COMPUTER SCIENCE / TECHNOLOGY
        ========================================================== */

                          if (
                            subjectName.includes("computer") ||
                            subjectName.includes("technology") ||
                            subjectName.includes("coding") ||
                            subjectName.includes("programming")
                          ) {
                            return (
                              <>
                                <rect
                                  x="3"
                                  y="4"
                                  width="18"
                                  height="13"
                                  rx="2"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                />
                                <path
                                  d="M8 21h8M12 17v4"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="m9 9 2 2-2 2M13 13h2"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </>
                            );
                          }

                          /* ==========================================================
           DEFAULT SUBJECT ICON
        ========================================================== */

                          return (
                            <>
                              <path
                                d="M4.5 5.25A2.25 2.25 0 0 1 6.75 3H11v16H6.75A2.25 2.25 0 0 0 4.5 21V5.25Z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                              />

                              <path
                                d="M19.5 5.25A2.25 2.25 0 0 0 17.25 3H13v16h4.25A2.25 2.25 0 0 1 19.5 21V5.25Z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                              />

                              <path
                                d="M7.5 7h1.75M7.5 10h1.75M14.75 7h1.75M14.75 10h1.75"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                              />
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* ------------------------------------------------
      ARROW
  ------------------------------------------------ */}

                    <div
                      className="
      flex
      h-10
      w-10
      items-center
      justify-center
      rounded-full
      border
      border-slate-200
      bg-white
      text-slate-400
      shadow-sm
      transition-all
      duration-300
      group-hover:translate-x-1
      group-hover:border-slate-300
      group-hover:text-slate-700
    "
                    >
                      →
                    </div>
                  </div>

                  {/* ------------------------------------------------
                      SUBJECT NAME
                  ------------------------------------------------ */}

                  <h3
                    className="
                      relative
                      max-w-[90%]
                      text-3xl
                      font-extrabold
                      leading-tight
                      tracking-[-0.035em]
                      text-slate-900
                      sm:text-[34px]
                    "
                  >
                    {subject.name}
                  </h3>

                  {/* ------------------------------------------------
                      ACCENT UNDERLINE
                  ------------------------------------------------ */}

                  <div
                    className={`
                      mt-4
                      h-1
                      w-10
                      rounded-full
                      ${style.accent}
                      transition-all
                      duration-300
                      group-hover:w-16
                    `}
                  />
                </div>

                {/* ==================================================
                    BODY
                ================================================== */}

                <div className="flex flex-1 flex-col px-7">
                  {/* ------------------------------------------------
                      DESCRIPTION
                  ------------------------------------------------ */}

                  <p
                    className="
                      text-sm
                      leading-6
                      text-slate-500
                    "
                  >
                    Explore engaging learning resources in{" "}
                    <span className="font-medium text-slate-700">
                      {subject.name}
                    </span>{" "}
                    designed to support students across different grade levels.
                  </p>
                </div>

                {/* ==================================================
                    FOOTER
                ================================================== */}

                <div
                  className="
                    mt-7
                    border-t
                    border-slate-100
                    px-7
                    py-5
                  "
                >
                  <div className="flex items-center justify-between">
                    {/* ------------------------------------------------
                        CTA
                    ------------------------------------------------ */}

                    <span
                      className="
                        text-sm
                        font-semibold
                        text-slate-700
                        transition-colors
                        duration-200
                        group-hover:text-slate-950
                      "
                    >
                      Explore {subject.name}
                    </span>

                    {/* ------------------------------------------------
                        CTA ARROW
                    ------------------------------------------------ */}

                    <div
                      className={`
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-full
                        ${style.soft}
                        ${style.accentText}
                        transition-all
                        duration-300
                        group-hover:translate-x-1
                      `}
                    >
                      →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
