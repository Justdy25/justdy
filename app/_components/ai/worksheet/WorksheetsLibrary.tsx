"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Copy,
  FileText,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { DuplicateWorksheet } from "@/app/actions/ai/duplicate-worksheet";
import { DeleteWorksheet } from "@/app/actions/ai/delete-worksheet";

import { renderClassicWorksheet } from "@/lib/ai/worksheet/templates/classic";

import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";

export interface SavedWorksheet {
  projectId: string;
  generationId: string;
  title: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  questionCount: number;
  updatedAt: string;
  worksheet: WorksheetDocument;
}

interface WorksheetsLibraryProps {
  initialWorksheets: SavedWorksheet[];
  initialError: string | null;
}

type SortOption = "recent" | "oldest" | "az" | "za";

export default function WorksheetsLibrary({
  initialWorksheets,
  initialError,
}: WorksheetsLibraryProps) {
  /*
   * ============================================================
   * STATE
   * ============================================================
   */

  const [search, setSearch] = useState("");

  const [gradeFilter, setGradeFilter] = useState("all");

  const [subjectFilter, setSubjectFilter] = useState("all");

  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const router = useRouter();

  const menuRef = useRef<HTMLDivElement | null>(null);

  /*
   * ============================================================
   * CLOSE MENU WHEN CLICKING OUTSIDE
   * ============================================================
   */

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current || !openMenuId) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openMenuId]);

  /*
   * ============================================================
   * FILTER OPTIONS
   * ============================================================
   */

  const grades = useMemo(() => {
    return Array.from(
      new Set(
        initialWorksheets
          .map((worksheet) => worksheet.gradeLevel.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [initialWorksheets]);

  const subjects = useMemo(() => {
    return Array.from(
      new Set(
        initialWorksheets
          .map((worksheet) => worksheet.subject.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [initialWorksheets]);

  /*
   * ============================================================
   * SEARCH + FILTER + SORT
   * ============================================================
   */

  const worksheets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = initialWorksheets.filter((worksheet) => {
      const matchesSearch =
        !normalizedSearch ||
        worksheet.title.toLowerCase().includes(normalizedSearch) ||
        worksheet.topic.toLowerCase().includes(normalizedSearch) ||
        worksheet.subject.toLowerCase().includes(normalizedSearch) ||
        worksheet.gradeLevel.toLowerCase().includes(normalizedSearch);

      const matchesGrade =
        gradeFilter === "all" || worksheet.gradeLevel === gradeFilter;

      const matchesSubject =
        subjectFilter === "all" || worksheet.subject === subjectFilter;

      return matchesSearch && matchesGrade && matchesSubject;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "az") {
        return a.title.localeCompare(b.title);
      }

      if (sortBy === "za") {
        return b.title.localeCompare(a.title);
      }

      if (sortBy === "oldest") {
        return (
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        );
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [initialWorksheets, search, gradeFilter, subjectFilter, sortBy]);

  /*
   * ============================================================
   * FILTER STATUS
   * ============================================================
   */

  const hasFilters =
    search.trim() !== "" || gradeFilter !== "all" || subjectFilter !== "all";

  function clearFilters() {
    setSearch("");
    setGradeFilter("all");
    setSubjectFilter("all");
    setSortBy("recent");
  }

  /*
   * ============================================================
   * OPEN WORKSHEET
   * ============================================================
   */

  function handleOpen(worksheet: SavedWorksheet) {
    setOpenMenuId(null);

    const projectId = worksheet.projectId?.trim();

    if (!projectId) {
      console.error(
        "[WorksheetsLibrary] Cannot open worksheet: missing projectId",
        worksheet,
      );

      window.alert(
        "Unable to open this worksheet because its project ID is missing.",
      );

      return;
    }

    const url = `/create/worksheet?projectId=${encodeURIComponent(
      projectId,
    )}`;

    console.log("[WorksheetsLibrary] Opening worksheet:", {
      projectId,
      url,
    });

    router.push(url);
  }

  /*
   * ============================================================
   * DUPLICATE
   * ============================================================
   *
   * Duplicate creates a new saved worksheet but MUST NOT open it.
   *
   * Open is intentionally handled only by handleOpen().
   * After duplication we refresh the library so the new copy
   * appears in the list while keeping the user on the library.
   */

  async function handleDuplicate(worksheet: SavedWorksheet) {
    setBusyProjectId(worksheet.projectId);

    setOpenMenuId(null);

    try {
      const result = await DuplicateWorksheet(worksheet.projectId);

      if (!result.success) {
        window.alert(result.error);
        return;
      }

      /*
       * Do NOT navigate to result.projectId here.
       *
       * The previous implementation called router.push(...)
       * after duplication, which caused Duplicate to behave like
       * Open. Refresh the current library route instead.
       */

      window.location.reload();
    } catch (error) {
      console.error("Duplicate worksheet error:", error);

      window.alert("Unable to duplicate worksheet.");
    } finally {
      setBusyProjectId(null);
    }
  }

  /*
   * ============================================================
   * DELETE
   * ============================================================
   */

  async function handleDelete(worksheet: SavedWorksheet) {
    const confirmed = window.confirm(
      `Delete "${worksheet.title}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyProjectId(worksheet.projectId);

    setOpenMenuId(null);

    try {
      const result = await DeleteWorksheet(worksheet.projectId);

      if (!result.success) {
        window.alert(result.error);
        return;
      }

      /*
       * Refresh the library so the
       * deleted worksheet disappears.
       */

      window.location.reload();
    } catch (error) {
      console.error("Delete worksheet error:", error);

      window.alert("Unable to delete worksheet.");
    } finally {
      setBusyProjectId(null);
    }
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />

              <h1 className="text-2xl font-bold">My Worksheets</h1>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              View and manage your saved worksheets.
            </p>
          </div>

          <Link
            href="/create/worksheet?new=1"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create Worksheet
          </Link>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {initialError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {initialError}
          </div>
        )}

        {/* =====================================================
            EMPTY DATABASE STATE
        ===================================================== */}

        {!initialError && initialWorksheets.length === 0 && (
          <div className="rounded-xl border bg-background p-12 text-center shadow-sm">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />

            <h2 className="mt-4 text-lg font-semibold">No worksheets yet</h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Create your first AI-powered worksheet and it will appear here.
            </p>

            <Link
              href="/create/worksheet?new=1"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Create Your First Worksheet
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* =====================================================
            TOOLBAR
        ===================================================== */}

        {initialWorksheets.length > 0 && (
          <>
            <div className="mb-5 rounded-xl border bg-background p-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row">
                {/* SEARCH */}

                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search worksheets, topics, subjects..."
                    className="h-10 w-full rounded-lg border bg-background pl-9 pr-9 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* GRADE */}

                <FilterSelect
                  value={gradeFilter}
                  onChange={setGradeFilter}
                  options={[
                    {
                      value: "all",
                      label: "All Grades",
                    },

                    ...grades.map((grade) => ({
                      value: grade,
                      label: grade,
                    })),
                  ]}
                />

                {/* SUBJECT */}

                <FilterSelect
                  value={subjectFilter}
                  onChange={setSubjectFilter}
                  options={[
                    {
                      value: "all",
                      label: "All Subjects",
                    },

                    ...subjects.map((subject) => ({
                      value: subject,
                      label: subject,
                    })),
                  ]}
                />

                {/* SORT */}

                <FilterSelect
                  value={sortBy}
                  onChange={(value) => setSortBy(value as SortOption)}
                  options={[
                    {
                      value: "recent",
                      label: "Recently Updated",
                    },

                    {
                      value: "oldest",
                      label: "Oldest",
                    },

                    {
                      value: "az",
                      label: "A → Z",
                    },

                    {
                      value: "za",
                      label: "Z → A",
                    },
                  ]}
                />
              </div>

              {/* FILTER STATUS */}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />

                  <span>
                    Showing{" "}
                    <strong className="font-semibold text-foreground">
                      {worksheets.length}
                    </strong>{" "}
                    of{" "}
                    <strong className="font-semibold text-foreground">
                      {initialWorksheets.length}
                    </strong>{" "}
                    worksheets
                  </span>
                </div>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* =================================================
                NO SEARCH RESULTS
            ================================================= */}

            {worksheets.length === 0 && (
              <div className="rounded-xl border bg-background p-10 text-center shadow-sm">
                <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />

                <h2 className="mt-4 text-base font-semibold">
                  No worksheets found
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Try changing your search or filters.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* =================================================
                WORKSHEET GRID
            ================================================= */}

            {worksheets.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {worksheets.map((worksheet) => {
                  const previewHtml = renderClassicWorksheet(
                    worksheet.worksheet,
                    {
                      template: "classic",

                      showAnswerKey: false,

                      showBranding: true,

                      showNameField: true,

                      showDateField: true,

                      showScoreField: true,

                      showPageNumbers: true,
                    },
                  );

                  const isBusy = busyProjectId === worksheet.projectId;

                  const isMenuOpen = openMenuId === worksheet.projectId;

                  return (
                    <div
                      key={worksheet.projectId}
                      className="group relative overflow-visible rounded-xl border bg-background shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                      {/* =================================================
                            PREVIEW
                        ================================================= */}

                      <Link
                        href={`/create/worksheet?projectId=${encodeURIComponent(
                          worksheet.projectId,
                        )}`}
                        className="block overflow-hidden rounded-t-xl"
                      >
                        <div className="relative aspect-[8.5/11] overflow-hidden border-b bg-slate-100 dark:bg-slate-950">
                          <iframe
                            title={`${worksheet.title} preview`}
                            srcDoc={previewHtml}
                            className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
                            style={{
                              width: "816px",

                              height: "1056px",

                              transform: "scale(0.39)",

                              transformOrigin: "top left",
                            }}
                          />

                          <div className="pointer-events-none absolute inset-0 bg-transparent transition group-hover:bg-primary/[0.03]" />
                        </div>
                      </Link>

                      {/* =================================================
                            INFORMATION
                        ================================================= */}

                      <Link
                        href={`/create/worksheet?projectId=${encodeURIComponent(
                          worksheet.projectId,
                        )}`}
                        className="block p-4 pr-12"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="line-clamp-2 text-sm font-semibold text-foreground">
                            {worksheet.title}
                          </h2>

                          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground">
                          {worksheet.subject}

                          {" • "}

                          {worksheet.gradeLevel}
                        </p>

                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {worksheet.topic}
                        </p>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{worksheet.questionCount} questions</span>

                          <span>
                            {new Date(worksheet.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>

                      {/* =================================================
                            ACTION MENU
                        ================================================= */}

                      <div
                        ref={isMenuOpen ? menuRef : undefined}
                        className="absolute bottom-3 right-3 z-30"
                      >
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            setOpenMenuId(
                              isMenuOpen ? null : worksheet.projectId,
                            );
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Actions for ${worksheet.title}`}
                          aria-expanded={isMenuOpen}
                          aria-haspopup="menu"
                        >
                          {isBusy ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </button>

                        {isMenuOpen && (
                          <div
                            role="menu"
                            className="absolute bottom-10 right-0 z-50 w-56 overflow-hidden rounded-xl border bg-background p-1.5 shadow-xl"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            {/* OPEN */}

                            <button
                              type="button"
                              role="menuitem"
                              disabled={isBusy}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();

                                handleOpen(worksheet);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground" />

                              <span>Open</span>
                            </button>

                            {/* DUPLICATE */}

                            <button
                              type="button"
                              role="menuitem"
                              disabled={isBusy}
                              onClick={() => handleDuplicate(worksheet)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Copy className="h-4 w-4 text-muted-foreground" />

                              <span>Duplicate</span>
                            </button>

                            {/* DELETE */}

                            <div className="my-1 border-t" />

                            <button
                              type="button"
                              role="menuitem"
                              disabled={isBusy}
                              onClick={() => handleDelete(worksheet)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />

                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* =============================================================
   FILTER SELECT
============================================================= */

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;

  onChange: (value: string) => void;

  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-37.5 appearance-none rounded-lg border bg-background px-3 pr-9 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
