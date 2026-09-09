"use client";

import { useState } from "react";
import { BookOpen, Loader2, Sparkles } from "lucide-react";

export default function LessonCreatePage() {
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [duration, setDuration] = useState("45");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setError("");

    if (!subject.trim() || !gradeLevel.trim() || !topic.trim()) {
      setError("Please enter a subject, grade level, and topic.");
      return;
    }

    setIsGenerating(true);

    try {
      const prompt = `Create a complete educational lesson plan.

Subject: ${subject}
Grade/Age: ${gradeLevel}
Topic: ${topic}
Lesson Duration: ${duration} minutes
Learning Objectives: ${
        learningObjectives.trim() || "Create appropriate learning objectives."
      }

The lesson should include:
- A clear lesson title
- Learning objectives
- Required materials
- Prior knowledge
- Warm-up/introduction
- Teacher instruction
- Guided practice
- Independent practice
- Assessment
- Differentiation/support
- Extension activity
- Homework or follow-up activity

Make the lesson age-appropriate, engaging, practical, and ready for a teacher to use in the classroom.`;

      const params = new URLSearchParams({
        prompt,
      });

      window.location.href = `/dashboard?${params.toString()}`;
    } catch (err) {
      console.error("Lesson generation error:", err);
      setError("Something went wrong. Please try again.");
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            Create
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Create a lesson
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Build a complete, classroom-ready lesson with AI. Define the
                topic, learners, objectives, and duration, and let Justdy
                structure the lesson for you.
              </p>
            </div>

            <div className="hidden rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex sm:items-center sm:gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              AI-powered
            </div>
          </div>
        </div>

        <section className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="font-semibold">Lesson details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Give Justdy enough context to create a useful lesson.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="lesson-subject" className="text-sm font-medium">
                  Subject
                </label>

                <input
                  id="lesson-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="e.g. Mathematics"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="lesson-grade" className="text-sm font-medium">
                  Grade / age level
                </label>

                <input
                  id="lesson-grade"
                  value={gradeLevel}
                  onChange={(event) => setGradeLevel(event.target.value)}
                  placeholder="e.g. Grade 1"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="lesson-topic" className="text-sm font-medium">
                Lesson topic
              </label>

              <input
                id="lesson-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. Adding numbers up to 20"
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <label
                  htmlFor="lesson-objectives"
                  className="text-sm font-medium"
                >
                  Learning objectives
                </label>

                <textarea
                  id="lesson-objectives"
                  value={learningObjectives}
                  onChange={(event) =>
                    setLearningObjectives(event.target.value)
                  }
                  placeholder="What should students know or be able to do by the end of the lesson?"
                  rows={5}
                  className="w-full resize-none rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="lesson-duration"
                  className="text-sm font-medium"
                >
                  Duration
                </label>

                <select
                  id="lesson-duration"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                >
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                </select>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                You can refine the generated lesson in the AI workspace.
              </p>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating lesson…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate lesson
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
