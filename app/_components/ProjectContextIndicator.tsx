"use client";

import { FolderKanban, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export interface ProjectContextIndicatorProps {
  projectId?: string | null;
  projectName?: string | null;
  compact?: boolean;
  className?: string;
}

export default function ProjectContextIndicator({
  projectId,
  projectName: providedProjectName,
  compact = false,
  className = "",
}: ProjectContextIndicatorProps) {
  const normalizedProjectId = projectId?.trim() || null;
  const normalizedProvidedName = providedProjectName?.trim() || null;

  const [fetchedProjectName, setFetchedProjectName] = useState<string | null>(
    null,
  );

  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!normalizedProjectId || normalizedProvidedName) {
      return;
    }

    const currentProjectId = normalizedProjectId;

    let cancelled = false;

    async function loadProject() {
      setLoadingProjectId(currentProjectId);

      try {
        const response = await fetch(
          `/api/ai/projects/${encodeURIComponent(currentProjectId)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load project.");
        }

        const data = (await response.json()) as {
          project?: {
            name?: string | null;
          };
        };

        if (!cancelled) {
          setFetchedProjectName(data.project?.name?.trim() || null);
        }
      } catch {
        if (!cancelled) {
          setFetchedProjectName(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingProjectId(null);
        }
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [normalizedProjectId, normalizedProvidedName]);

  if (!normalizedProjectId) {
    return null;
  }

  const isLoading =
    !normalizedProvidedName && loadingProjectId === normalizedProjectId;

  const displayName = normalizedProvidedName || fetchedProjectName || "Project";

  if (compact) {
    return (
      <div
        className={`inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 ${className}`}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
        ) : (
          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        )}

        <span className="truncate">
          {isLoading ? "Loading project..." : displayName}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        ) : (
          <FolderKanban className="h-4 w-4 text-slate-600" />
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Project
        </p>

        <p className="truncate text-sm font-semibold text-slate-900">
          {isLoading ? "Loading project..." : displayName}
        </p>
      </div>
    </div>
  );
}
