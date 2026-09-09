"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  FolderKanban,
  ImageIcon,
  LayoutGrid,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Presentation,
  Search,
  Sparkles,
  Video,
  X,
} from "lucide-react";

import { Button } from "@/app/_components/ui/button";
import { Card, CardContent } from "@/app/_components/ui/card";
import { Input } from "@/app/_components/ui/input";

type ProjectType =
  | "GENERAL"
  | "WORKSHEET"
  | "WORKBOOK"
  | "LESSON"
  | "QUIZ"
  | "PRESENTATION"
  | "YOUTUBE"
  | "JUSTDY_KIDZ";

type Project = {
  id: string;
  name: string;
  description: string | null;
  type: ProjectType;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  createdAt: string;
  updatedAt: string;
  _count: {
    assets: number;
    conversations: number;
    generations: number;
  };
};

type ProjectsResponse = {
  success: boolean;
  projects: Project[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

const PROJECT_TYPES: Array<{
  value: ProjectType | "ALL";
  label: string;
}> = [
  { value: "ALL", label: "All projects" },
  { value: "GENERAL", label: "General" },
  { value: "WORKSHEET", label: "Worksheet" },
  { value: "WORKBOOK", label: "Workbook" },
  { value: "LESSON", label: "Lesson" },
  { value: "QUIZ", label: "Quiz" },
  { value: "PRESENTATION", label: "Presentation" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "JUSTDY_KIDZ", label: "Justdy Kidz" },
];

function getTypeLabel(type: ProjectType) {
  return PROJECT_TYPES.find((item) => item.value === type)?.label ?? "General";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelativeDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Date.now() - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < minute) {
    return "Just now";
  }

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}m ago`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h ago`;
  }

  if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days}d ago`;
  }

  return formatDate(value);
}

function ProjectIcon({
  type,
  className,
}: {
  type: ProjectType;
  className?: string;
}) {
  switch (type) {
    case "WORKSHEET":
    case "WORKBOOK":
      return <FileText className={className} />;

    case "LESSON":
      return <BookOpen className={className} />;

    case "QUIZ":
      return <CheckCircle2 className={className} />;

    case "PRESENTATION":
      return <Presentation className={className} />;

    case "YOUTUBE":
      return <Video className={className} />;

    case "JUSTDY_KIDZ":
      return <Sparkles className={className} />;

    default:
      return <FolderKanban className={className} />;
  }
}

function ProjectCard({
  project,
  onArchive,
}: {
  project: Project;
  onArchive: (project: Project) => void;
}) {
  return (
    <Card className="group overflow-hidden border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md">
      <CardContent className="p-0">
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-muted via-card to-muted">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_35%)]" />

          <div className="absolute left-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-sm ring-1 ring-border">
            <ProjectIcon
              type={project.type}
              className="h-6 w-6 text-foreground"
            />
          </div>

          <div className="absolute bottom-4 left-5">
            <span className="rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              {getTypeLabel(project.type)}
            </span>
          </div>

          <button
            type="button"
            aria-label={`More options for ${project.name}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onArchive(project);
            }}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        <Link href={`/projects/${project.id}`} className="block">
          <div className="p-5">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="line-clamp-1 text-base font-semibold text-foreground">
                {project.name}
              </h2>

              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>

            <p className="mb-5 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
              {project.description || "No description added yet."}
            </p>

            <div className="grid grid-cols-3 divide-x divide-border border-t border-border/70 pt-4">
              <div className="flex items-center gap-2 pr-3">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {project._count.generations}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Creations</p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {project._count.assets}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Assets</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {project._count.conversations}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Chats</p>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              Updated {formatRelativeDate(project.updatedAt)}
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

function ProjectSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-36 animate-pulse bg-muted" />

      <div className="space-y-4 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted" />

        <div className="grid grid-cols-3 gap-3 border-t border-border/70 pt-4">
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function CreateProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("GENERAL");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function handleCreate() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Project name is required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          type,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        project?: Project;
        error?: string;
      };

      if (!response.ok || !data.success || !data.project) {
        throw new Error(data.error || "Unable to create the project.");
      }

      onCreated(data.project);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create the project.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-5">
          <div>
            <h2
              id="create-project-title"
              className="text-lg font-semibold text-foreground"
            >
              Create a project
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organize your AI creations in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label
              htmlFor="project-name"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Project name
            </label>

            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Grade 1 Math Workbook"
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Description
              <span className="ml-1 font-normal text-muted-foreground">
                optional
              </span>
            </label>

            <textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What are you creating?"
              maxLength={2000}
              rows={4}
              className="flex w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label
              htmlFor="project-type"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Project type
            </label>

            <div className="relative">
              <select
                id="project-type"
                value={type}
                onChange={(event) => setType(event.target.value as ProjectType)}
                className="h-10 w-full appearance-none rounded-md border border-border bg-card px-3 pr-10 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring"
              >
                {PROJECT_TYPES.filter((item) => item.value !== "ALL").map(
                  (item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border/70 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create project
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  const [activeType, setActiveType] = useState<ProjectType | "ALL">("ALL");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [hasMore, setHasMore] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createDialogKey, setCreateDialogKey] = useState(0);

  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);

  function openCreateProject() {
    setCreateDialogKey((current) => current + 1);
    setShowCreate(true);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  const fetchProjects = useCallback(
    async ({
      cursor,
      append,
    }: {
      cursor?: string | null;
      append?: boolean;
    } = {}) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const params = new URLSearchParams();

        params.set("status", "ACTIVE");
        params.set("limit", "30");

        if (activeType !== "ALL") {
          params.set("type", activeType);
        }

        if (search) {
          params.set("search", search);
        }

        if (cursor) {
          params.set("cursor", cursor);
        }

        const response = await fetch(`/api/ai/projects?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = (await response.json()) as
          | ProjectsResponse
          | {
              error?: string;
            };

        if (!response.ok || !("success" in data) || !data.success) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Unable to load projects.",
          );
        }

        setProjects((current) =>
          append ? [...current, ...data.projects] : data.projects,
        );

        setNextCursor(data.pagination.nextCursor);

        setHasMore(data.pagination.hasMore);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load projects.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeType, search],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchProjects();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [fetchProjects]);

  const visibleProjects = useMemo(() => projects, [projects]);

  function handleCreated(project: Project) {
    setProjects((current) => [project, ...current]);
  }

  async function handleArchive() {
    if (!archiveTarget) {
      return;
    }

    const projectId = archiveTarget.id;

    setArchiveTarget(null);

    setProjects((current) =>
      current.filter((project) => project.id !== projectId),
    );

    try {
      const response = await fetch(`/api/ai/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "ARCHIVED",
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to archive the project.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to archive the project.",
      );

      void fetchProjects();
    }
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <FolderKanban className="h-4 w-4" />
                  Projects
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Your projects
                </h1>

                <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Keep your AI creations, conversations, and assets organized in
                  one workspace.
                </p>
              </div>

              <Button
                type="button"
                onClick={openCreateProject}
                className="shrink-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                New project
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 lg:px-10">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2">
              {PROJECT_TYPES.map((item) => {
                const active = activeType === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setActiveType(item.value)}
                    className={[
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:border-border hover:bg-background",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search projects..."
                className="pl-9"
              />
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => void fetchProjects()}
                className="font-medium underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <ProjectSkeleton key={index} />
              ))}
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="flex min-h-[460px] items-center justify-center rounded-2xl border border-dashed border-border bg-card">
              <div className="mx-auto max-w-md px-6 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  {search || activeType !== "ALL" ? (
                    <Search className="h-7 w-7 text-muted-foreground" />
                  ) : (
                    <LayoutGrid className="h-7 w-7 text-muted-foreground" />
                  )}
                </div>

                <h2 className="text-lg font-semibold text-foreground">
                  {search || activeType !== "ALL"
                    ? "No projects found"
                    : "Create your first project"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {search || activeType !== "ALL"
                    ? "Try a different search or project type."
                    : "Projects give you a dedicated place to organize conversations, AI generations, and assets."}
                </p>

                {search || activeType !== "ALL" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-5"
                    onClick={() => {
                      setSearchInput("");
                      setActiveType("ALL");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="mt-5"
                    onClick={openCreateProject}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create project
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onArchive={setArchiveTarget}
                  />
                ))}
              </div>

              {hasMore && nextCursor && (
                <div className="mt-8 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() =>
                      void fetchProjects({
                        cursor: nextCursor,
                        append: true,
                      })
                    }
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more projects"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CreateProjectDialog
        key={createDialogKey}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />

      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Archive className="h-5 w-5 text-muted-foreground" />
            </div>

            <h2 className="text-lg font-semibold text-foreground">
              Archive project?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              “{archiveTarget.name}” will be removed from your active projects.
              Its creations and assets will remain associated with the project.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setArchiveTarget(null)}
              >
                Cancel
              </Button>

              <Button type="button" onClick={() => void handleArchive()}>
                Archive
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
