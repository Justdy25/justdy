"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Info,
  Layers3,
  Sparkles,
} from "lucide-react";

import { Card } from "@/app/_components/ui/card";

type ProjectContext = {
  instructions: string;
  audience: string;
  gradeLevel: string;
  subject: string;
  preferences: string;
};

type ProjectContextIndicatorProps = {
  projectId?: string | null;
  compact?: boolean;
  className?: string;
};

const EMPTY_CONTEXT: ProjectContext = {
  instructions: "",
  audience: "",
  gradeLevel: "",
  subject: "",
  preferences: "",
};

function normalizeContext(value: unknown): ProjectContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_CONTEXT;
  }

  const source = value as Record<string, unknown>;

  return {
    instructions:
      typeof source.instructions === "string" ? source.instructions.trim() : "",
    audience: typeof source.audience === "string" ? source.audience.trim() : "",
    gradeLevel:
      typeof source.gradeLevel === "string" ? source.gradeLevel.trim() : "",
    subject: typeof source.subject === "string" ? source.subject.trim() : "",
    preferences:
      typeof source.preferences === "string" ? source.preferences.trim() : "",
  };
}

export default function ProjectContextIndicator({
  projectId,
  compact = false,
  className = "",
}: ProjectContextIndicatorProps) {
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<string | null>(null);
  const [context, setContext] = useState<ProjectContext>(EMPTY_CONTEXT);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      const normalizedProjectId = projectId?.trim();

      if (!normalizedProjectId) {
        setProjectName(null);
        setProjectType(null);
        setContext(EMPTY_CONTEXT);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(
          `/api/ai/projects/${encodeURIComponent(normalizedProjectId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load project.");
        }

        const data = (await response.json()) as {
          project?: {
            name?: string | null;
            type?: string | null;
            context?: unknown;
          };
        };

        if (cancelled) {
          return;
        }

        setProjectName(data.project?.name ?? null);
        setProjectType(data.project?.type ?? null);
        setContext(normalizeContext(data.project?.context));
      } catch {
        if (!cancelled) {
          setProjectName(null);
          setProjectType(null);
          setContext(EMPTY_CONTEXT);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId || (!loading && !projectName)) {
    return null;
  }

  const hasContext =
    Boolean(context.instructions) ||
    Boolean(context.audience) ||
    Boolean(context.gradeLevel) ||
    Boolean(context.subject) ||
    Boolean(context.preferences);

  const contextItems = [
    {
      label: "Audience",
      value: context.audience,
      icon: GraduationCap,
    },
    {
      label: "Grade level",
      value: context.gradeLevel,
      icon: BookOpen,
    },
    {
      label: "Subject",
      value: context.subject,
      icon: Layers3,
    },
    {
      label: "Preferences",
      value: context.preferences,
      icon: Info,
    },
    {
      label: "AI instructions",
      value: context.instructions,
      icon: Sparkles,
    },
  ].filter((item) => item.value);

  return (
    <Card
      className={[
        "overflow-hidden border-slate-200 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center justify-between gap-3",
          compact ? "px-3 py-2.5" : "px-4 py-3",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={[
              "flex shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white",
              compact ? "h-8 w-8" : "h-9 w-9",
            ].join(" ")}
          >
            <Sparkles className={compact ? "h-4 w-4" : "h-4.5 w-4.5"} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Creating in
              </span>

              <span className="truncate text-sm font-semibold text-slate-900">
                {loading ? "Loading project..." : projectName}
              </span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {projectType && (
                <span className="text-xs text-slate-400">
                  {projectType
                    .replaceAll("_", " ")
                    .toLowerCase()
                    .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Project context active
              </span>
            </div>
          </div>
        </div>

        {hasContext && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {expanded ? "Hide" : "View"}
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {expanded && hasContext && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contextItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />

                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {item.label}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            This context is automatically used as standing guidance for
            creations in this project. Your individual request still takes
            priority as the current task.
          </p>
        </div>
      )}
    </Card>
  );
}
