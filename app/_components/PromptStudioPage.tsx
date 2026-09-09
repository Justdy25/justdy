"use client";

import { Suspense, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Headphones,
  Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectContextIndicator from "@/app/_components/ProjectContextIndicator";

type StudioKind = "audio" | "document" | "lesson" | "quiz";

const CONFIG: Record<
  StudioKind,
  {
    title: string;
    description: string;
    placeholder: string;
    icon: typeof FileText;
    instruction: string;
  }
> = {
  audio: {
    title: "Create audio",
    description: "Turn your idea into an AI-assisted audio creation.",
    placeholder: "Describe the audio you want Justdy AI to create...",
    icon: Headphones,
    instruction: "Describe the topic, audience, tone, length, and style.",
  },

  document: {
    title: "Create a document",
    description:
      "Create polished educational or professional documents with Justdy AI.",
    placeholder: "Describe the document you want Justdy AI to create...",
    icon: FileText,
    instruction:
      "Include the document type, audience, structure, and important content.",
  },

  lesson: {
    title: "Create a lesson",
    description:
      "Build a structured lesson plan ready to refine with Justdy AI.",
    placeholder: "Describe the lesson you want Justdy AI to create...",
    icon: BookOpen,
    instruction:
      "Include grade level, subject, topic, objectives, and desired activities.",
  },

  quiz: {
    title: "Create a quiz",
    description:
      "Create a focused quiz that you can continue refining in Justdy AI.",
    placeholder: "Describe the quiz you want Justdy AI to create...",
    icon: ClipboardCheck,
    instruction:
      "Include grade level, subject, topic, question count, and question types.",
  },
};

function requestId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function PromptStudioContent({ kind }: { kind: StudioKind }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = searchParams.get("projectId")?.trim() || null;

  const config = CONFIG[kind];
  const Icon = config.icon;

  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const destination = useMemo(() => {
    const params = new URLSearchParams();

    params.set("prompt", prompt.trim());
    params.set("new", requestId());

    if (projectId) {
      params.set("projectId", projectId);
    }

    return `/dashboard?${params.toString()}`;
  }, [prompt, projectId]);

  function continueToAI() {
    const value = prompt.trim();

    if (!value) {
      setError("Describe what you want to create first.");
      return;
    }

    setError(null);
    router.push(destination);
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* =========================================================
              HEADER
          ========================================================= */}

          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Icon className="h-5 w-5" />
            </div>

            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
              <Sparkles className="h-3 w-3" />
              Justdy AI
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {config.title}
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              {config.description}
            </p>

            {/* =======================================================
                PROJECT CONTEXT
            ======================================================= */}

            {projectId && (
              <div className="mt-4 flex justify-center">
                <ProjectContextIndicator projectId={projectId} compact />
              </div>
            )}
          </div>

          {/* =========================================================
              PROMPT CARD
          ========================================================= */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icon className="h-4 w-4 text-primary" />
                Tell Justdy AI what you need
              </div>

              {projectId && (
                <p className="mt-1 text-xs text-slate-400">
                  This creation will stay connected to the current project.
                </p>
              )}
            </div>

            <div className="p-5 sm:p-6">
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);

                  if (error) {
                    setError(null);
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    continueToAI();
                  }
                }}
                rows={9}
                maxLength={10000}
                placeholder={config.placeholder}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
              />

              {/* =====================================================
                  PROMPT HELP
              ===================================================== */}

              <div className="mt-2 flex items-center justify-between gap-4">
                <p className="text-xs text-slate-400">{config.instruction}</p>

                <span className="shrink-0 text-[11px] text-slate-400">
                  {prompt.length}/10000
                </span>
              </div>

              {/* =====================================================
                  ERROR
              ===================================================== */}

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              {/* =====================================================
                  ACTIONS
              ===================================================== */}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-400">
                  You can edit the prompt again before sending it to AI.
                </p>

                <button
                  type="button"
                  onClick={continueToAI}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                >
                  Continue with AI
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          {/* =========================================================
              WORKFLOW STEPS
          ========================================================= */}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              "Describe the outcome",
              "Add useful constraints",
              "Refine in Chat",
            ].map((step, index) => (
              <div
                key={step}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                  {index + 1}
                </div>

                <p className="text-xs font-medium text-slate-800">{step}</p>
              </div>
            ))}
          </div>

          {/* =========================================================
              PROJECT PRESERVATION MESSAGE
          ========================================================= */}

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5" />

            {projectId
              ? "Your project context is preserved when you continue."
              : "Your creation will open in Justdy AI when you continue."}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PromptStudioPage({ kind }: { kind: StudioKind }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-4rem)] bg-slate-50">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 h-11 w-11 animate-pulse rounded-2xl bg-slate-200" />

                <div className="mx-auto mb-2 h-6 w-20 animate-pulse rounded-full bg-slate-200" />

                <div className="mx-auto h-10 w-64 animate-pulse rounded-lg bg-slate-200" />

                <div className="mx-auto mt-3 h-5 max-w-xl animate-pulse rounded bg-slate-200" />
              </div>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                </div>

                <div className="p-5 sm:p-6">
                  <div className="h-52 animate-pulse rounded-xl bg-slate-100" />

                  <div className="mt-6 flex justify-end">
                    <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-200" />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      }
    >
      <PromptStudioContent kind={kind} />
    </Suspense>
  );
}
