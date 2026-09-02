"use client";

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

import { CreateVideoGeneration } from "../actions/manage-ai-video";

import {
  GetAIVideoSubjects,
  GetAIVideoTopics,
} from "../actions/manage-ai-video-data";

import { GetMyAIVideoCreditBalance } from "../actions/manage-ai-video-credits";

import { getAIVideoCreditCost } from "@/lib/ai-video-pricing";

import { GradeLevel } from "@/lib/generated/prisma/enums";

/* ============================================================
   TYPES
============================================================ */

type GenerationStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type VideoItem = {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  duration: number;
  status: GenerationStatus;
  createdAt: string;
};

/* ============================================================
   OPTIONS
============================================================ */

const styles = [
  {
    value: "Educational Animation",
    description: "Friendly animated educational content",
  },
  {
    value: "Explainer",
    description: "Clean visual explanations",
  },
  {
    value: "Classroom",
    description: "Teacher-style classroom presentation",
  },
  {
    value: "Cinematic",
    description: "More cinematic and engaging visuals",
  },
];

const durations = [
  {
    value: 5,
    label: "5 seconds",
    credits: 10,
  },
  {
    value: 10,
    label: "10 seconds",
    credits: 20,
  },
  {
    value: 15,
    label: "15 seconds",
    credits: 30,
  },
];

const aspectRatios = [
  {
    value: "16:9",
    label: "Landscape",
    description: "YouTube / classroom",
  },
  {
    value: "9:16",
    label: "Portrait",
    description: "Shorts / Reels / TikTok",
  },
  {
    value: "1:1",
    label: "Square",
    description: "Social media",
  },
];

/* ============================================================
   COMPONENT
============================================================ */

export default function AIVideoStudio() {
  const [prompt, setPrompt] = useState("");

  const [style, setStyle] = useState("Educational Animation");

  const [duration, setDuration] = useState(10);

  const [aspectRatio, setAspectRatio] = useState("16:9");

  const [subjectId, setSubjectId] = useState("");

  const [gradeLevel, setGradeLevel] = useState("");

  const [topicId, setTopicId] = useState("");

  const [subjects, setSubjects] = useState<
    {
      id: string;
      name: string;
    }[]
  >([]);

  const [topics, setTopics] = useState<
    {
      id: string;
      name: string;
      gradeLevel: string;
    }[]
  >([]);

  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);

  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);

  const [showSettings, setShowSettings] = useState(false);

  const [videos, setVideos] = useState<VideoItem[]>([
    {
      id: "demo-1",
      title: "Introduction to Photosynthesis",
      subject: "Science",
      gradeLevel: "Grade 6",
      duration: 10,
      status: "COMPLETED",
      createdAt: "Today",
    },
    {
      id: "demo-2",
      title: "Understanding Fractions",
      subject: "Mathematics",
      gradeLevel: "Grade 5",
      duration: 10,
      status: "COMPLETED",
      createdAt: "Yesterday",
    },
  ]);

  /* ============================================================
     DERIVED VALUES
  ============================================================ */

  const selectedSubject = subjects.find((subject) => subject.id === subjectId);

  const selectedTopic = topics.find((topic) => topic.id === topicId);

  const topic = selectedTopic?.name ?? "";

  const subject = selectedSubject?.name ?? "";

  const selectedDuration = useMemo(
    () => durations.find((item) => item.value === duration) ?? durations[1],
    [duration],
  );

  /*
   * Credit cost comes from the shared pricing
   * configuration.
   */
  const creditCost = getAIVideoCreditCost(duration);

  const canAffordVideo = creditBalance !== null && creditBalance >= creditCost;

  /* ============================================================
     LOAD SUBJECTS
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    async function loadSubjects() {
      setIsLoadingSubjects(true);

      try {
        const result = await GetAIVideoSubjects();

        if (cancelled) {
          return;
        }

        if (result.success) {
          setSubjects(result.subjects);

          /*
           * Select the first subject only if
           * nothing has been selected yet.
           */
          if (result.subjects.length > 0) {
            setSubjectId((current) => current || result.subjects[0].id);
          }
        } else {
          console.error(result.error);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load subjects:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSubjects(false);
        }
      }
    }

    loadSubjects();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     LOAD CREDIT BALANCE
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    async function loadCredits() {
      setIsLoadingCredits(true);

      try {
        const result = await GetMyAIVideoCreditBalance();

        if (cancelled) {
          return;
        }

        if (result.success) {
          setCreditBalance(result.balance);
        } else {
          console.error(result.error);

          setCreditBalance(0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load AI video credits:", error);

          setCreditBalance(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCredits(false);
        }
      }
    }

    loadCredits();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     LOAD TOPICS
  ============================================================ */

  useEffect(() => {
    /*
     * Do not synchronously call setState here when
     * subject/grade is empty.
     *
     * The handlers below clear the topics when the
     * user changes subject or grade.
     */

    if (!subjectId || !gradeLevel) {
      return;
    }

    let cancelled = false;

    async function loadTopics() {
      setIsLoadingTopics(true);

      try {
        const result = await GetAIVideoTopics(subjectId, gradeLevel);

        if (cancelled) {
          return;
        }

        if (result.success) {
          setTopics(result.topics);
        } else {
          console.error(result.error);

          setTopics([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load topics:", error);

          setTopics([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTopics(false);
        }
      }
    }

    loadTopics();

    return () => {
      cancelled = true;
    };
  }, [subjectId, gradeLevel]);

  /* ============================================================
     SUBJECT CHANGE
  ============================================================ */

  function handleSubjectChange(value: string) {
    setSubjectId(value);

    /*
     * Changing the subject invalidates the
     * currently selected topic.
     */
    setTopics([]);
    setTopicId("");
  }

  /* ============================================================
     GRADE LEVEL CHANGE
  ============================================================ */

  function handleGradeLevelChange(value: string) {
    setGradeLevel(value);

    /*
     * Changing grade invalidates the current
     * topic list and selection.
     */
    setTopics([]);
    setTopicId("");
  }

  /* ============================================================
     GENERATE VIDEO
  ============================================================ */

  async function handleGenerate() {
    if (!prompt.trim()) {
      alert("Please describe what you want the video to teach.");

      return;
    }

    if (!subjectId) {
      alert("Please select a subject.");

      return;
    }

    if (!gradeLevel) {
      alert("Please select a grade level.");

      return;
    }

    /*
     * Client-side credit check for UX.
     *
     * The server performs the real check again,
     * so this cannot be bypassed by manipulating
     * the browser.
     */
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
      const result = await CreateVideoGeneration({
        prompt: prompt.trim(),

        subjectId,

        topicId: topicId || undefined,

        /*
         * Convert the string value from
         * the select into the Prisma enum type.
         *
         * No `any` required.
         */
        gradeLevel: gradeLevel as GradeLevel,

        title: topic || undefined,

        style,

        duration,

        aspectRatio,
      });

      if (!result.success) {
        alert(result.error);

        return;
      }

      const generation = result.generation;

      /*
       * Immediately reflect the server-side
       * credit deduction in the UI.
       */
      setCreditBalance((current) =>
        current === null ? null : Math.max(0, current - creditCost),
      );

      /*
       * Add the new generation to the
       * recent generations list.
       */
      setVideos((current) => [
        {
          id: generation.id,

          title:
            topic ||
            prompt.trim().slice(0, 55) +
              (prompt.trim().length > 55 ? "..." : ""),

          subject,

          gradeLevel,

          duration,

          status: "PENDING",

          createdAt: "Just now",
        },

        ...current,
      ]);

      /*
       * Reset the prompt after successful
       * creation.
       */
      setPrompt("");

      /*
       * Clear topic selection.
       */
      setTopicId("");
    } catch (error) {
      console.error("Generate video error:", error);

      alert(
        "Something went wrong while creating the video generation request.",
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
              Create engaging educational videos from a simple idea.
            </p>
          </div>

          {/* ====================================================
              CREDIT BALANCE
          ==================================================== */}

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
                    Describe what you want your students to learn.
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
                <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">
                  What should this video teach?
                </label>

                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Example: Explain photosynthesis to a Grade 6 student using a fun animated plant and simple examples..."
                    rows={6}
                    maxLength={1000}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
                  />

                  <div className="absolute bottom-3 right-3 text-[11px] text-slate-400">
                    {prompt.length}/1000
                  </div>
                </div>
              </div>

              {/* ==================================================
                  QUICK CONTEXT
              ================================================== */}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Subject">
                  <Select
                    value={subjectId}
                    onChange={handleSubjectChange}
                    disabled={isLoadingSubjects}
                    options={subjects.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                    placeholder={
                      isLoadingSubjects
                        ? "Loading subjects..."
                        : "Select subject"
                    }
                  />
                </Field>

                <Field label="Grade level">
                  <Select
                    value={gradeLevel}
                    onChange={handleGradeLevelChange}
                    options={[
                      {
                        value: "Grade1",
                        label: "Grade 1",
                      },
                      {
                        value: "Grade2",
                        label: "Grade 2",
                      },
                      {
                        value: "Grade3",
                        label: "Grade 3",
                      },
                      {
                        value: "Grade4",
                        label: "Grade 4",
                      },
                      {
                        value: "Grade5",
                        label: "Grade 5",
                      },
                      {
                        value: "Grade6",
                        label: "Grade 6",
                      },
                      {
                        value: "Grade7",
                        label: "Grade 7",
                      },
                      {
                        value: "Grade8",
                        label: "Grade 8",
                      },
                      {
                        value: "Grade9",
                        label: "Grade 9",
                      },
                      {
                        value: "Grade10",
                        label: "Grade 10",
                      },
                      {
                        value: "Grade11",
                        label: "Grade 11",
                      },
                      {
                        value: "Grade12",
                        label: "Grade 12",
                      },
                    ]}
                    placeholder="Select grade level"
                  />
                </Field>
              </div>

              {/* ==================================================
                  TOPIC
              ================================================== */}

              <Field
                label="Topic"
                optional
                hint={
                  !subjectId || !gradeLevel
                    ? "Select a subject and grade first."
                    : undefined
                }
              >
                <Select
                  value={topicId}
                  onChange={setTopicId}
                  disabled={!subjectId || !gradeLevel || isLoadingTopics}
                  options={topics.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  placeholder={
                    isLoadingTopics
                      ? "Loading topics..."
                      : topics.length === 0
                        ? "No topics available"
                        : "Select topic"
                  }
                />
              </Field>

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
                      Style, duration and format
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
                <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-3">
                  <Field label="Style">
                    <Select
                      value={style}
                      onChange={setStyle}
                      options={styles.map((item) => ({
                        value: item.value,
                        label: item.value,
                      }))}
                    />
                  </Field>

                  <Field label="Duration">
                    <Select
                      value={String(duration)}
                      onChange={(value) => setDuration(Number(value))}
                      options={durations.map((item) => ({
                        value: String(item.value),
                        label: `${item.label} · ${item.credits} credits`,
                      }))}
                    />
                  </Field>

                  <Field label="Format">
                    <Select
                      value={aspectRatio}
                      onChange={setAspectRatio}
                      options={aspectRatios.map((item) => ({
                        value: item.value,
                        label: `${item.value} · ${item.label}`,
                      }))}
                    />
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

          {/* ======================================================
              PREVIEW / SETTINGS
          ====================================================== */}

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
                    aspectRatio === "9:16"
                      ? "aspect-[9/14]"
                      : aspectRatio === "1:1"
                        ? "aspect-square"
                        : "aspect-video"
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
                      Your generated video will appear here.
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
                    Include the learning objective, student age or grade,
                    examples you want shown, and the visual style you prefer.
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

            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all
            </button>
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
                Your generated videos will appear here.
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
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}

          {optional && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              Optional
            </span>
          )}
        </label>

        {hint && (
          <span className="hidden text-[11px] text-slate-400 sm:block">
            {hint}
          </span>
        )}
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

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <div className="relative aspect-video overflow-hidden bg-slate-950">
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
              {video.subject} · {video.gradeLevel}
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
