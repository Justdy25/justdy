"use client";

import Link from "next/link";
import { useState } from "react";

interface TopicOption {
  id: string;
  name: string;
  slug: string;
  gradeLevel: string;
  subjectId: string;
}

interface SubjectColor {
  accent: string;
  soft: string;
  text: string;
  border: string;
}

interface SubjectFiltersProps {
  subjectId: string;
  gradeLevels: string[];
  activeGradeLevel?: string;
  visibleTopics: TopicOption[];
  activeTopicId?: string;
  activeTopicName?: string;
  currentType?: string;
  searchQuery?: string;
  colors: SubjectColor;
  hasFilters: boolean;
}

function formatGradeLabel(value?: string) {
  if (!value) return "All grades";

  const normalized = String(value).replace(/[_-]/g, " ").trim();
  const match = normalized.match(/^grade\s*(\d+)$/i);

  if (match) return `Grade ${match[1]}`;
  if (/^\d+$/.test(normalized)) return `Grade ${normalized}`;

  return normalized.replace(/^grade\s+/i, "Grade ");
}

function buildFilterHref(params: {
  subjectId: string;
  gradeLevel?: string;
  topicId?: string;
  type?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  query.set("subjectId", params.subjectId);

  if (params.gradeLevel) query.set("gradeLevel", params.gradeLevel);
  if (params.topicId) query.set("topicId", params.topicId);
  if (params.type) query.set("type", params.type);
  if (params.search) query.set("search", params.search);

  return `/products?${query.toString()}`;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      aria-hidden="true"
    >
      <path
        d="m5 7.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SubjectFilters({
  subjectId,
  gradeLevels,
  activeGradeLevel,
  visibleTopics,
  activeTopicId,
  activeTopicName,
  currentType,
  searchQuery,
  colors,
  hasFilters,
}: SubjectFiltersProps) {
  const [openMenu, setOpenMenu] = useState<"grade" | "topic" | null>(null);

  const closeMenu = () => setOpenMenu(null);

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
      {/* GRADE LEVEL */}
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setOpenMenu((current) => (current === "grade" ? null : "grade"))
          }
          aria-expanded={openMenu === "grade"}
          className="
            flex items-center gap-3 rounded-xl border border-slate-200
            bg-white px-4 py-2.5 text-sm font-bold text-slate-700
            shadow-sm transition-all hover:border-slate-300 hover:shadow-md
          "
        >
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            Grade
          </span>

          <span className="max-w-[140px] truncate text-slate-900">
            {formatGradeLabel(activeGradeLevel)}
          </span>

          <ChevronIcon open={openMenu === "grade"} />
        </button>

        {openMenu === "grade" && (
          <div className="absolute left-0 top-full z-50 mt-2 min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
            <Link
              href={buildFilterHref({
                subjectId,
                type: currentType,
                search: searchQuery,
              })}
              onClick={closeMenu}
              className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                !activeGradeLevel
                  ? `${colors.soft} ${colors.text}`
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              All grades
            </Link>

            {gradeLevels.map((grade) => (
              <Link
                key={grade}
                href={buildFilterHref({
                  subjectId,
                  gradeLevel: grade,
                  type: currentType,
                  search: searchQuery,
                })}
                onClick={closeMenu}
                className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  activeGradeLevel === grade
                    ? `${colors.soft} ${colors.text}`
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {formatGradeLabel(grade)}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* TOPIC */}
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setOpenMenu((current) => (current === "topic" ? null : "topic"))
          }
          aria-expanded={openMenu === "topic"}
          className="
            flex items-center gap-3 rounded-xl border border-slate-200
            bg-white px-4 py-2.5 text-sm font-bold text-slate-700
            shadow-sm transition-all hover:border-slate-300 hover:shadow-md
          "
        >
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            Topic
          </span>

          <span className="max-w-[190px] truncate text-slate-900">
            {activeTopicName || "All topics"}
          </span>

          <ChevronIcon open={openMenu === "topic"} />
        </button>

        {openMenu === "topic" && (
          <div className="absolute left-0 top-full z-50 mt-2 max-h-80 min-w-[240px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
            <Link
              href={buildFilterHref({
                subjectId,
                gradeLevel: activeGradeLevel,
                type: currentType,
                search: searchQuery,
              })}
              onClick={closeMenu}
              className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                !activeTopicId
                  ? `${colors.soft} ${colors.text}`
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              All topics
            </Link>

            {visibleTopics.map((topic) => (
              <Link
                key={topic.id}
                href={buildFilterHref({
                  subjectId,
                  gradeLevel: topic.gradeLevel,
                  topicId: topic.id,
                  type: currentType,
                  search: searchQuery,
                })}
                onClick={closeMenu}
                className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  activeTopicId === topic.id
                    ? `${colors.soft} ${colors.text}`
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {topic.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* CLEAR FILTERS */}
      {hasFilters && (
        <Link
          href={`/products?subjectId=${encodeURIComponent(subjectId)}`}
          onClick={closeMenu}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-800"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
