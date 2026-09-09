"use client";

import { useState } from "react";
import { FileQuestion, Loader2, Sparkles } from "lucide-react";

export default function QuizCreatePage() {
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState("Mixed");
  const [questionType, setQuestionType] = useState("Multiple choice");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
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
      const prompt = `Create a complete educational quiz.

Subject: ${subject}
Grade/Age: ${gradeLevel}
Topic: ${topic}
Number of Questions: ${questionCount}
Difficulty: ${difficulty}
Primary Question Type: ${questionType}
Additional Instructions: ${additionalInstructions.trim() || "None provided."}

The quiz should:
- Be appropriate for the specified grade/age.
- Focus on the requested topic.
- Contain clear, unambiguous questions.
- Include answer choices when appropriate.
- Include the correct answer for every question.
- Include a concise explanation for each answer.
- Progress appropriately in difficulty.
- Avoid trick questions unless specifically requested.
- Be suitable for classroom or independent student use.

Also include:
- A clear quiz title
- Student name and date fields
- Instructions
- A complete answer key`;

      const params = new URLSearchParams({
        prompt,
      });

      window.location.href = `/dashboard?${params.toString()}`;
    } catch (err) {
      console.error("Quiz generation error:", err);
      setError("Something went wrong. Please try again.");
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileQuestion className="h-4 w-4" />
            Create
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Create a quiz
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Generate an engaging quiz tailored to your subject, learners,
                topic, difficulty, and preferred question format.
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
            <h2 className="font-semibold">Quiz details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define what you want students to be assessed on.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="quiz-subject" className="text-sm font-medium">
                  Subject
                </label>

                <input
                  id="quiz-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="e.g. Mathematics"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="quiz-grade" className="text-sm font-medium">
                  Grade / age level
                </label>

                <input
                  id="quiz-grade"
                  value={gradeLevel}
                  onChange={(event) => setGradeLevel(event.target.value)}
                  placeholder="e.g. Grade 3"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="quiz-topic" className="text-sm font-medium">
                Quiz topic
              </label>

              <input
                id="quiz-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. Fractions"
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label
                  htmlFor="quiz-question-count"
                  className="text-sm font-medium"
                >
                  Questions
                </label>

                <select
                  id="quiz-question-count"
                  value={questionCount}
                  onChange={(event) => setQuestionCount(event.target.value)}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                >
                  <option value="5">5 questions</option>
                  <option value="10">10 questions</option>
                  <option value="15">15 questions</option>
                  <option value="20">20 questions</option>
                  <option value="25">25 questions</option>
                  <option value="30">30 questions</option>
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="quiz-difficulty"
                  className="text-sm font-medium"
                >
                  Difficulty
                </label>

                <select
                  id="quiz-difficulty"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="quiz-question-type"
                  className="text-sm font-medium"
                >
                  Question type
                </label>

                <select
                  id="quiz-question-type"
                  value={questionType}
                  onChange={(event) => setQuestionType(event.target.value)}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                >
                  <option value="Multiple choice">Multiple choice</option>
                  <option value="True or false">True or false</option>
                  <option value="Short answer">Short answer</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="quiz-instructions"
                className="text-sm font-medium"
              >
                Additional instructions
              </label>

              <textarea
                id="quiz-instructions"
                value={additionalInstructions}
                onChange={(event) =>
                  setAdditionalInstructions(event.target.value)
                }
                placeholder="Optional: specify standards, concepts, question style, or anything else the AI should consider."
                rows={5}
                className="w-full resize-none rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                You can continue refining the quiz with Justdy AI after
                generation.
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
                    Creating quiz…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate quiz
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
