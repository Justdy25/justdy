"use client";
import ProjectContextIndicator from "@/app/_components/ProjectContextIndicator";
import React, { useEffect, useMemo, useState } from "react";
import {
  Clapperboard,
  Sparkles,
  Play,
  Clock3,
  MonitorPlay,
  WandSparkles,
  ChevronDown,
  Loader2,
  Video,
  History,
  Info,
  CheckCircle2,
  X,
  CreditCard,
} from "lucide-react";

/* ============================================================
   TYPES
============================================================ */

type GenerationStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type VideoModel = "sora-2" | "sora-2-pro";

type VideoDuration = 4 | 8 | 12;

type VideoAspectRatio = "16:9" | "9:16";

type VideoItem = {
  id: string;
  title: string;
  duration: number;
  status: GenerationStatus;
  createdAt: string;
  aspectRatio: string;
  model: string | null;
  videoUrl: string | null;
};

type CreateVideoResponse = {
  success: true;
  generation: {
    id: string;
    status: GenerationStatus;
    provider: string;
    model: string | null;
    providerTaskId: string | null;
    prompt: string;
    duration: number;
    aspectRatio: string;
    creditsUsed: number;
    createdAt: string;
  };
};

type ApiErrorResponse = {
  success: false;
  error: string;
  code?: string;
  required?: number;
  available?: number;
};

type VideoStatusResponse = {
  success: true;
  generation: {
    id: string;
    status: GenerationStatus;
    provider: string;
    model: string | null;
    duration: number;
    aspectRatio: string;
    creditsUsed: number;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
  };
};

/* ============================================================
   OPTIONS
============================================================ */

const durations = [
  {
    value: 4,
    label: "4 seconds",
    creditsSora2: 10,
    creditsSora2Pro: 20,
  },
  {
    value: 8,
    label: "8 seconds",
    creditsSora2: 20,
    creditsSora2Pro: 40,
  },
  {
    value: 12,
    label: "12 seconds",
    creditsSora2: 30,
    creditsSora2Pro: 60,
  },
] as const;

const aspectRatios = [
  {
    value: "16:9",
    label: "Landscape",
    description: "YouTube, websites, presentations",
  },
  {
    value: "9:16",
    label: "Portrait",
    description: "Shorts, Reels, TikTok",
  },
] as const;

const models = [
  {
    value: "sora-2",
    label: "Sora 2",
    description: "Fast, high-quality video generation",
  },
  {
    value: "sora-2-pro",
    label: "Sora 2 Pro",
    description: "Higher-quality generation",
  },
] as const;

const styles = [
  {
    value: "Cinematic",
    description: "Dramatic, polished cinematic visuals",
  },
  {
    value: "Realistic",
    description: "Natural, lifelike visual style",
  },
  {
    value: "Animated",
    description: "Stylized animated visuals",
  },
  {
    value: "Documentary",
    description: "Natural documentary-style presentation",
  },
  {
    value: "Commercial",
    description: "Polished advertising and promotional style",
  },
  {
    value: "Minimal",
    description: "Clean and visually simple presentation",
  },
] as const;

/* ============================================================
   COMPONENT
============================================================ */

export default function AIVideoStudio({
  projectId = null,
}: {
  projectId?: string | null;
}) {
  const [prompt, setPrompt] = useState("");

  const [model, setModel] = useState<VideoModel>("sora-2");

  const [duration, setDuration] = useState<VideoDuration>(8);

  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");

  const [style, setStyle] = useState<string>("Cinematic");

  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);

  const [showSettings, setShowSettings] = useState(false);

  const [videos, setVideos] = useState<VideoItem[]>([]);

  /* ============================================================
     DERIVED VALUES
  ============================================================ */

  const selectedDuration = useMemo(
    () => durations.find((item) => item.value === duration) ?? durations[1],
    [duration],
  );

  const creditCost =
    model === "sora-2-pro"
      ? selectedDuration.creditsSora2Pro
      : selectedDuration.creditsSora2;

  const canAffordVideo = creditBalance !== null && creditBalance >= creditCost;

  /* ============================================================
     LOAD CREDIT BALANCE
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    async function loadCredits() {
      setIsLoadingCredits(true);

      try {
        const response = await fetch("/api/credits", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load credit balance.");
        }

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (typeof data.balance === "number") {
          setCreditBalance(data.balance);
        } else {
          setCreditBalance(0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load AI credits:", error);

          setCreditBalance(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCredits(false);
        }
      }
    }

    void loadCredits();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     POLL VIDEO GENERATION
  ============================================================ */

  async function pollVideoGeneration(generationId: string) {
    const maxAttempts = 120;
    const interval = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/ai/video/${generationId}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = (await response.json()) as
          | VideoStatusResponse
          | ApiErrorResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.success === false
              ? data.error
              : "Unable to retrieve video status.",
          );
        }

        const generation = data.generation;

        setVideos((current) =>
          current.map((video) =>
            video.id === generation.id
              ? {
                  ...video,
                  status: generation.status,
                  duration: generation.duration,
                  aspectRatio: generation.aspectRatio,
                  model: generation.model,
                  videoUrl: generation.videoUrl,
                }
              : video,
          ),
        );

        if (generation.status === "COMPLETED") {
          if (projectId) {
            try {
              await fetch(
                `/api/ai/video/${encodeURIComponent(generation.id)}/artifact`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ projectId }),
                },
              );
              window.dispatchEvent(new CustomEvent("justdy:artifact-created"));
            } catch (artifactError) {
              console.error("Failed to persist video artifact:", artifactError);
            }
          }

          await refreshCreditBalance();
          return generation;
        }

        if (
          generation.status === "FAILED" ||
          generation.status === "CANCELLED"
        ) {
          /*
           * The server handles the refund.
           */
          alert(generation.errorMessage || "Video generation failed.");

          /*
           * Refresh the balance after a terminal
           * generation because a refund may have
           * occurred.
           */
          await refreshCreditBalance();

          return generation;
        }
      } catch (error) {
        /*
         * A temporary network failure should not
         * immediately kill a long-running Sora
         * generation.
         */
        console.error("Video polling error:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    console.error(`Video generation polling timed out: ${generationId}`);
  }

  /* ============================================================
     REFRESH CREDITS
  ============================================================ */

  async function refreshCreditBalance() {
    try {
      const response = await fetch("/api/credits", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (typeof data.balance === "number") {
        setCreditBalance(data.balance);
      }
    } catch (error) {
      console.error("Failed to refresh credits:", error);
    }
  }

  /* ============================================================
     GENERATE VIDEO
  ============================================================ */

  async function handleGenerate() {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      alert("Please describe the video you want to create.");
      return;
    }

    if (trimmedPrompt.length > 4000) {
      alert("Your video prompt cannot exceed 4000 characters.");
      return;
    }

    if (creditBalance === null) {
      alert("Your credit balance is still loading. Please try again.");
      return;
    }

    if (creditBalance < creditCost) {
      alert(
        `You need ${creditCost} credits to generate this video. You currently have ${creditBalance}.`,
      );
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          prompt: trimmedPrompt,
          duration,
          aspectRatio,
          model,
          style: style || undefined,
          projectId: projectId || undefined,
          requestId: crypto.randomUUID(),
        }),
      });

      const data = (await response.json()) as
        | CreateVideoResponse
        | ApiErrorResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.success === false
            ? data.error
            : "Unable to start video generation.",
        );
      }

      const generation = data.generation;

      /*
       * The server has already charged the exact
       * amount of credits.
       */
      setCreditBalance((current) =>
        current === null ? null : Math.max(0, current - generation.creditsUsed),
      );

      const title =
        trimmedPrompt.length > 60
          ? `${trimmedPrompt.slice(0, 60)}...`
          : trimmedPrompt;

      setVideos((current) => [
        {
          id: generation.id,
          title,
          duration: generation.duration,
          aspectRatio: generation.aspectRatio,
          model: generation.model,
          status: generation.status,
          createdAt: "Just now",
          videoUrl: null,
        },
        ...current,
      ]);

      setPrompt("");

      /*
       * Begin monitoring the asynchronous
       * Sora generation.
       */
      void pollVideoGeneration(generation.id);
    } catch (error) {
      console.error("Generate video error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the video.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clapperboard className="h-5 w-5" />
              </div>

              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Justdy AI
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              AI Video Studio
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Turn your ideas into AI-generated video with a simple text prompt.
            </p>
          </div>

          {projectId && (
            <ProjectContextIndicator
              projectId={projectId}
              compact
              className="mt-4"
            />
          )}

          {/* CREDIT BALANCE */}

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Sparkles className="h-4 w-4 text-primary" />

              <span className="font-medium text-slate-700 dark:text-slate-200">
                {isLoadingCredits
                  ? "Loading credits..."
                  : `${creditBalance ?? 0} credits`}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================
            MAIN WORKSPACE
        ====================================================== */}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* ====================================================
              CREATOR
          ==================================================== */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-950 dark:text-white">
                    Create a video
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Describe the video you want Justdy AI to create.
                  </p>
                </div>

                <div className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
                  <WandSparkles className="h-3.5 w-3.5" />
                  AI assisted
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {/* ==================================================
                  PROMPT
              ================================================== */}

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Describe your video
                  </label>

                  <span className="text-[11px] text-slate-400">
                    {prompt.length}/4000
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Example: A cinematic aerial shot of a futuristic city at night, neon lights reflecting on rain-soaked streets, dramatic lighting, realistic film quality..."
                    rows={7}
                    maxLength={4000}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
                  />
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Describe the subject, setting, movement, camera angle,
                  lighting, mood, and visual details you want.
                </p>
              </div>

              {/* ==================================================
                  EXAMPLES
              ================================================== */}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Prompt ideas
                </p>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    "A cinematic sunset over a tropical beach with gentle waves and palm trees moving in the wind.",
                    "A futuristic sports car driving through a neon-lit city at night in the rain.",
                    "A playful animated dog trying to cook breakfast in a small colorful kitchen.",
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setPrompt(example)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs leading-5 text-slate-600 transition hover:border-primary/30 hover:bg-primary/[0.03] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {/* ==================================================
                  ADVANCED SETTINGS
              ================================================== */}

              <button
                type="button"
                onClick={() => setShowSettings((value) => !value)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-900">
                    <MonitorPlay className="h-4 w-4 text-slate-500" />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Video settings
                    </p>

                    <p className="text-xs text-slate-400">
                      Model, duration, format and style
                    </p>
                  </div>
                </div>

                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${
                    showSettings ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showSettings && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  {/* MODEL */}

                  <Field label="Video model">
                    <Select
                      value={model}
                      onChange={(value) => setModel(value as VideoModel)}
                      options={models.map((item) => ({
                        value: item.value,
                        label: item.label,
                      }))}
                    />

                    <p className="mt-1.5 text-[11px] text-slate-400">
                      {models.find((item) => item.value === model)?.description}
                    </p>
                  </Field>

                  {/* DURATION + FORMAT */}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Duration">
                      <Select
                        value={String(duration)}
                        onChange={(value) =>
                          setDuration(Number(value) as VideoDuration)
                        }
                        options={durations.map((item) => ({
                          value: String(item.value),
                          label: `${item.label} · ${
                            model === "sora-2-pro"
                              ? item.creditsSora2Pro
                              : item.creditsSora2
                          } credits`,
                        }))}
                      />
                    </Field>

                    <Field label="Format">
                      <Select
                        value={aspectRatio}
                        onChange={(value) =>
                          setAspectRatio(value as VideoAspectRatio)
                        }
                        options={aspectRatios.map((item) => ({
                          value: item.value,
                          label: `${item.value} · ${item.label}`,
                        }))}
                      />

                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {
                          aspectRatios.find(
                            (item) => item.value === aspectRatio,
                          )?.description
                        }
                      </p>
                    </Field>
                  </div>

                  {/* STYLE */}

                  <Field label="Visual style">
                    <Select
                      value={style}
                      onChange={setStyle}
                      options={styles.map((item) => ({
                        value: item.value,
                        label: item.value,
                      }))}
                    />

                    <p className="mt-1.5 text-[11px] text-slate-400">
                      {styles.find((item) => item.value === style)?.description}
                    </p>
                  </Field>
                </div>
              )}

              {/* ==================================================
                  GENERATE
              ================================================== */}

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                  <span>
                    This generation uses{" "}
                    <strong className="font-semibold text-slate-700 dark:text-slate-300">
                      {creditCost} credits
                    </strong>
                    .
                  </span>
                </div>

                <button
                  type="button"
                  disabled={
                    isGenerating ||
                    isLoadingCredits ||
                    !prompt.trim() ||
                    !canAffordVideo
                  }
                  onClick={handleGenerate}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating video...
                    </>
                  ) : isLoadingCredits ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking credits...
                    </>
                  ) : !canAffordVideo ? (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Not enough credits
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate · {creditCost} credits
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* ====================================================
              PREVIEW
          ==================================================== */}

          <aside className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-primary" />

                  <h2 className="font-semibold text-slate-950 dark:text-white">
                    Video preview
                  </h2>
                </div>
              </div>

              <div className="p-5">
                <div
                  className={`relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950 ${
                    aspectRatio === "9:16" ? "aspect-[9/14]" : "aspect-video"
                  }`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.25),transparent_45%)]" />

                  <div className="relative px-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <Video className="h-6 w-6 text-white/70" />
                    </div>

                    <p className="text-sm font-medium text-white">
                      Your video preview
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/45">
                      Your generated video will appear in your recent
                      generations below.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x rounded-xl border border-slate-200 dark:border-slate-800">
                  <Stat
                    icon={<Clock3 className="h-3.5 w-3.5" />}
                    label="Duration"
                    value={`${duration}s`}
                  />

                  <Stat
                    icon={<MonitorPlay className="h-3.5 w-3.5" />}
                    label="Format"
                    value={aspectRatio}
                  />

                  <Stat
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    label="Credits"
                    value={String(creditCost)}
                  />
                </div>
              </div>
            </section>

            {/* ==================================================
                AI TIP
            ================================================== */}

            <section className="rounded-2xl border border-primary/10 bg-primary/[0.04] p-5 dark:border-primary/20 dark:bg-primary/[0.06]">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Get better results
                  </h3>

                  <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Describe the subject, environment, action, camera movement,
                    lighting, mood, and visual style you want. The more useful
                    visual detail you provide, the more control you give the
                    model.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        {/* ========================================================
            RECENT VIDEOS
        ======================================================== */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />

                <h2 className="font-semibold text-slate-950 dark:text-white">
                  Recent generations
                </h2>
              </div>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Your latest AI-created videos.
              </p>
            </div>
          </div>

          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Video className="h-5 w-5 text-slate-400" />
              </div>

              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No videos yet
              </h3>

              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                Describe your first video above and Justdy AI will create it for
                you.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ============================================================
   FIELD
============================================================ */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
        </label>
      </div>

      {children}
    </div>
  );
}

/* ============================================================
   SELECT
============================================================ */

function Select({
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-9 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/* ============================================================
   STAT
============================================================ */

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-3">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>

      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   VIDEO CARD
============================================================ */

function VideoCard({ video }: { video: VideoItem }) {
  const isProcessing = video.status === "PROCESSING";

  const isPending = video.status === "PENDING";

  const isFailed = video.status === "FAILED";

  const isCompleted = video.status === "COMPLETED";

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <div
        className={`relative overflow-hidden bg-slate-950 ${
          video.aspectRatio === "9:16" ? "aspect-[9/14]" : "aspect-video"
        }`}
      >
        {isCompleted && video.videoUrl ? (
          <video
            src={video.videoUrl}
            controls
            preload="metadata"
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.24),transparent_50%)]" />

            {isProcessing || isPending ? (
              <div className="relative flex h-full flex-col items-center justify-center text-center">
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-white/70" />

                <span className="text-xs font-medium text-white/80">
                  {isPending ? "Queued..." : "Generating..."}
                </span>
              </div>
            ) : isFailed ? (
              <div className="relative flex h-full flex-col items-center justify-center">
                <X className="mb-2 h-6 w-6 text-white/60" />

                <span className="text-xs text-white/60">Generation failed</span>
              </div>
            ) : (
              <div className="relative flex h-full items-center justify-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition group-hover:scale-105">
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                </div>
              </div>
            )}
          </>
        )}

        <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
          {video.duration}s
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {video.title}
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              {video.model ?? "Sora"} · {video.aspectRatio}
            </p>
          </div>

          {video.status === "COMPLETED" && (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          )}
        </div>

        <div className="mt-3 text-[11px] text-slate-400">{video.createdAt}</div>
      </div>
    </div>
  );
}
