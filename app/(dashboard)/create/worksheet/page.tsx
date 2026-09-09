"use client";

import { Suspense, FormEvent, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckSquare, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import ProjectContextIndicator from "@/app/_components/ProjectContextIndicator";

const gradeLevels = [
  "Pre-K",
  "Kindergarten",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

const difficulties = [
  {
    value: "easy",
    label: "Easy",
    description: "Foundational practice",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Grade-level practice",
  },
  {
    value: "hard",
    label: "Hard",
    description: "More challenging",
  },
];

const questionTypes = [
  "Multiple choice",
  "Fill in the blank",
  "Short answer",
  "Matching",
  "True or false",
];

function WorksheetCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /*
   * Project context is carried through the creation flow.
   *
   * When this page is opened from a project:
   * /create/worksheet?projectId=<project-id>
   *
   * the same projectId must be preserved when entering AI Chat.
   */
  const projectId = searchParams.get("projectId")?.trim() || null;

  const [gradeLevel, setGradeLevel] = useState("Grade 1");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>([
    "Multiple choice",
  ]);

  const canContinue = useMemo(() => {
    return (
      gradeLevel.trim() !== "" &&
      subject.trim() !== "" &&
      topic.trim() !== "" &&
      Number(questionCount) > 0 &&
      selectedQuestionTypes.length > 0
    );
  }, [gradeLevel, subject, topic, questionCount, selectedQuestionTypes]);

  function toggleQuestionType(type: string) {
    setSelectedQuestionTypes((current) => {
      if (current.includes(type)) {
        return current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canContinue) {
      return;
    }

    const prompt = [
      "Create a beautiful educational worksheet.",
      "",
      `Grade level: ${gradeLevel}`,
      `Subject: ${subject.trim()}`,
      `Topic: ${topic.trim()}`,
      `Number of questions: ${questionCount}`,
      `Difficulty: ${difficulty}`,
      `Question types: ${selectedQuestionTypes.join(", ")}`,
      "",
      "Make the worksheet original, age-appropriate, clear, printable, and classroom-ready.",
      "Use a professional traditional worksheet layout with generous whitespace and sufficient response space.",
      "Do not design it like a SaaS dashboard or web interface.",
    ].join("\n");

    const newChatToken = crypto.randomUUID();

    const params = new URLSearchParams({
      prompt,
      new: newChatToken,
    });

    if (projectId) {
      params.set("projectId", projectId);
    }

    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
        {/* Back */}
        <button
          type="button"
          onClick={() =>
            router.push(
              projectId
                ? `/create?projectId=${encodeURIComponent(projectId)}`
                : "/create",
            )
          }
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to creation
        </button>

        {/* Header */}
        <section className="mb-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
              <CheckSquare className="h-6 w-6 text-blue-600" />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                Create a worksheet
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Tell us a little about the worksheet you want to create.
              </p>
            </div>
          </div>

          {projectId && (
            <ProjectContextIndicator
              projectId={projectId}
              compact
              className="mt-4"
            />
          )}
        </section>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-950">
                What should the worksheet teach?
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                These details help Justdy AI generate age-appropriate content.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Grade level
                </span>

                <select
                  value={gradeLevel}
                  onChange={(event) => setGradeLevel(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  {gradeLevels.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Subject
                </span>

                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="e.g. Mathematics"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Topic
                </span>

                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="e.g. Addition within 20"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </label>
            </div>
          </section>

          {/* Worksheet settings */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Worksheet settings
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                You can refine everything later in the AI conversation.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Number of questions
                </span>

                <input
                  type="number"
                  min={1}
                  max={100}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </label>

              <div>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Difficulty
                </span>

                <div className="grid grid-cols-3 gap-2">
                  {difficulties.map((option) => {
                    const selected = difficulty === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDifficulty(option.value)}
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          selected
                            ? "border-slate-900 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>

                        <span
                          className={`mt-1 block text-xs ${
                            selected ? "text-slate-300" : "text-slate-400"
                          }`}
                        >
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Question types */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Question types
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select one or more types for the worksheet.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {questionTypes.map((type) => {
                const selected = selectedQuestionTypes.includes(type);

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleQuestionType(type)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                      selected
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Continue */}
          <div className="flex items-center justify-end border-t border-slate-200 pt-6">
            <button
              type="submit"
              disabled={!canContinue}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Sparkles className="h-4 w-4" />
              Start creating
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorksheetCreatePage() {
  return (
    <Suspense fallback={null}>
      <WorksheetCreateContent />
    </Suspense>
  );
}
