"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  FileText,
  FolderKanban,
  ImageIcon,
  Loader2,
  Play,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import Image from "next/image";

const FILTERS = [
  { value: "", label: "All" },
  { value: "IMAGE", label: "Images" },
  { value: "VIDEO", label: "Videos" },
  { value: "AUDIO", label: "Audio" },
  { value: "DOCUMENT", label: "Documents" },
] as const;

type AssetType = "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO" | "OTHER";

type Artifact = {
  id: string;
  type: AssetType;
  name: string;
  url: string | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  generation: {
    id: string;
    type: string;
    status: string;
    prompt: string;
    model: string | null;
    createdAt: string;
  } | null;
  metadata: unknown;
};

type ProjectSummary = {
  id: string;
  name: string;
};

type ResponseShape = {
  assets?: Artifact[];
  pagination?: {
    hasMore?: boolean;
    nextCursor?: string | null;
  };
  error?: string;
};

function getPath(asset: Artifact) {
  const metadata = asset.metadata;

  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const editorPath = (metadata as { editorPath?: unknown }).editorPath;

    if (typeof editorPath === "string" && editorPath.startsWith("/")) {
      return editorPath;
    }
  }

  if (asset.type === "IMAGE" && asset.url) {
    return asset.url;
  }

  if (asset.type === "VIDEO" && asset.generation?.id) {
    return `/api/ai/video/${encodeURIComponent(asset.generation.id)}/content`;
  }

  return "/library";
}

function iconFor(type: AssetType) {
  if (type === "IMAGE") return ImageIcon;
  if (type === "VIDEO") return Video;
  if (type === "AUDIO") return AudioLines;
  return FileText;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export interface ArtifactLibraryProps {
  initialProjectId?: string | null;
}

export default function ArtifactLibrary({
  initialProjectId = null,
}: ArtifactLibraryProps) {
  const [filter, setFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState(
    initialProjectId?.trim() || "",
  );
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<Artifact[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const response = await fetch(
          "/api/ai/projects?status=ACTIVE&limit=100",
          { cache: "no-store" },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          projects?: Array<{
            id?: string;
            name?: string;
          }>;
        };

        if (!cancelled) {
          setProjects(
            (data.projects ?? []).flatMap((project) =>
              project.id && project.name
                ? [{ id: project.id, name: project.name }]
                : [],
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
        }
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  const projectNames = new Map(
    projects.map((project) => [project.id, project.name]),
  );

  const load = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      try {
        const params = new URLSearchParams({
          limit: "24",
        });

        if (filter) {
          params.set("type", filter);
        }

        if (projectFilter) {
          params.set("projectId", projectFilter);
        }

        if (nextCursor) {
          params.set("cursor", nextCursor);
        }

        const response = await fetch(`/api/ai/library?${params.toString()}`, {
          cache: "no-store",
        });

        const data = (await response.json()) as ResponseShape;

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load library.");
        }

        const nextAssets = data.assets ?? [];

        setAssets((current) =>
          append ? [...current, ...nextAssets] : nextAssets,
        );

        setCursor(data.pagination?.nextCursor ?? null);

        setHasMore(Boolean(data.pagination?.hasMore));

        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load library.",
        );
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [filter, projectFilter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(null, false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    const onUpdated = () => {
      void load(null, false);
    };

    window.addEventListener("justdy:artifact-created", onUpdated);

    return () =>
      window.removeEventListener("justdy:artifact-created", onUpdated);
  }, [load]);

  const visibleAssets = query.trim()
    ? assets.filter((asset) =>
        `${asset.name} ${asset.generation?.prompt ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : assets;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Every AI creation saved as a first-class Justdy artifact.
          </p>
        </div>

        <Link
          href={
            projectFilter
              ? `/create?projectId=${encodeURIComponent(projectFilter)}`
              : "/create"
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Sparkles className="size-4" />
          Create something
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your creations..."
            className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={projectFilter}
            onChange={(event) => {
              setLoading(true);
              setProjectFilter(event.target.value);
            }}
            aria-label="Filter by project"
            className="h-10 min-w-48 rounded-xl border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All projects</option>

            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setFilter(item.value);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  filter === item.value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border bg-card">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : visibleAssets.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
          <Sparkles className="mx-auto mb-3 size-8 text-muted-foreground" />

          <p className="font-medium">No matching artifacts</p>

          <p className="mt-1 text-sm text-muted-foreground">
            {projectFilter
              ? "This project does not have any matching artifacts yet."
              : "Generate a creation or adjust your filter."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleAssets.map((asset) => {
            const Icon = iconFor(asset.type);
            const href = getPath(asset);

            const projectName = asset.projectId
              ? (projectNames.get(asset.projectId) ?? "Project")
              : null;

            return (
              <Link
                key={asset.id}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className="group overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {asset.type === "IMAGE" && asset.url ? (
                    <Image
                      src={asset.thumbnailUrl ?? asset.url}
                      alt={asset.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : asset.type === "VIDEO" && asset.thumbnailUrl ? (
                    <Image
                      src={asset.thumbnailUrl}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Icon className="size-10 text-muted-foreground" />
                    </div>
                  )}

                  {asset.type === "VIDEO" && (
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-medium">
                      <Play className="size-3" />
                      Video
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <p className="truncate font-medium">{asset.name}</p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {asset.type.toLowerCase()} · {formatDate(asset.createdAt)}
                  </p>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FolderKanban className="size-3.5 shrink-0" />

                    <span className="truncate">
                      {projectName ? `Project: ${projectName}` : "No project"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {hasMore && !query && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              if (!cursor) return;

              setLoadingMore(true);
              void load(cursor, true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {loadingMore ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowDown className="size-4" />
            )}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
