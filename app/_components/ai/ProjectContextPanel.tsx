"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/app/_components/ui/button";
import { Card, CardContent } from "@/app/_components/ui/card";
import {
  EMPTY_PROJECT_CONTEXT,
  type ProjectContext,
} from "@/lib/ai/project-context";
export default function ProjectContextPanel({
  projectId,
}: {
  projectId: string;
}) {
  const [context, setContext] = useState<ProjectContext>({
    ...EMPTY_PROJECT_CONTEXT,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/ai/projects/${encodeURIComponent(projectId)}/context`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error || "Unable to load project context.");
        return d;
      })
      .then((d) => {
        if (!cancelled)
          setContext({ ...EMPTY_PROJECT_CONTEXT, ...(d.context || {}) });
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to load project context.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  const update = (key: keyof ProjectContext, value: string) => {
    setSaved(false);
    setContext((c) => ({ ...c, [key]: value }));
  };
  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const r = await fetch(
        `/api/ai/projects/${encodeURIComponent(projectId)}/context`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to save project context.");
      setContext({ ...EMPTY_PROJECT_CONTEXT, ...(d.context || {}) });
      setSaved(true);
      window.dispatchEvent(
        new CustomEvent("justdy:project-context-updated", {
          detail: { projectId },
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save project context.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <Sparkles className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Project context
              </h2>
              <p className="text-sm text-slate-500">
                Standing guidance Justdy AI uses throughout this project.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={loading || saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save context
          </Button>
        </div>
        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading project context…
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {(
              [
                ["audience", "Audience", "e.g. Elementary school teachers"],
                ["gradeLevel", "Grade level", "e.g. Grade 1"],
                ["subject", "Subject", "e.g. Mathematics"],
                [
                  "preferences",
                  "Preferences",
                  "e.g. Clear, printable, age-appropriate",
                ],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {label}
                </span>
                <input
                  value={context[key]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>
            ))}
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                AI instructions
              </span>
              <textarea
                value={context.instructions}
                onChange={(e) => update("instructions", e.target.value)}
                rows={5}
                placeholder="Tell Justdy AI how you want this project handled…"
                className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
              <p className="text-xs text-slate-400">
                These instructions are included as project-level guidance in AI
                Chat.
              </p>
            </label>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {saved && (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Project context saved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
