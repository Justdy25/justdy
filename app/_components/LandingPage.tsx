"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  Layers3,
  MessageSquareText,
  Sparkles,
  Users,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";
import MarketingNavbar from "./MarketingNavbar";
import MarketingFooter from "./MarketingFooter";
import { AuthModal } from "@/app/(auth)/AuthModal";

const audiences = [
  {
    icon: GraduationCap,
    title: "Students",
    description:
      "Understand difficult topics, practice with personalized resources, and get help when you need it.",
  },
  {
    icon: BookOpen,
    title: "Teachers",
    description:
      "Create worksheets, lessons, quizzes, activities, and other teaching resources with AI.",
  },
  {
    icon: Users,
    title: "Parents",
    description:
      "Give children better learning support with engaging resources and access to trusted tutoring.",
  },
  {
    icon: Layers3,
    title: "Schools",
    description:
      "Bring AI-powered content creation, learning resources, and tutoring into one ecosystem.",
  },
];

const aiTools = [
  {
    icon: FileText,
    title: "Worksheets",
    description: "Generate polished, classroom-ready worksheets in minutes.",
    href: "/create/worksheet",
  },
  {
    icon: BookOpen,
    title: "Lessons",
    description: "Turn ideas and topics into structured learning experiences.",
    href: "/create/lesson",
  },
  {
    icon: Brain,
    title: "Quizzes",
    description:
      "Create questions, practice activities, and assessments with AI.",
    href: "/create/quiz",
  },
  {
    icon: WandSparkles,
    title: "More with AI",
    description:
      "Create videos, images, documents, audio, and other learning content.",
    href: "/dashboard",
  },
];

const steps = [
  {
    number: "01",
    title: "Tell Justdy what you need",
    description:
      "Describe a topic, grade level, learning objective, lesson idea, or resource you want to create.",
  },
  {
    number: "02",
    title: "AI builds it for you",
    description:
      "Justdy transforms your idea into useful educational content that you can review and refine.",
  },
  {
    number: "03",
    title: "Teach, learn, or share",
    description:
      "Use your creation immediately, save it to your library, or turn to a tutor for live support.",
  },
];

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");

  const openSignup = () => {
    setAuthMode("signup");
    setAuthOpen(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingNavbar />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border bg-foreground">
          <div className="absolute inset-0">
            <div className="absolute left-[-10%] top-[-30%] h-[600px] w-[600px] rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute right-[-10%] top-[5%] h-[500px] w-[500px] rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute bottom-[-30%] left-[35%] h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 sm:px-8 lg:px-12 lg:pb-28 lg:pt-24">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/[0.06] px-4py-2 text-sm font-medium text-slate-200 backdrop-blur">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                AI-powered learning and development
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <h1 className="text-balance text-5xl font-semibold tracking-[-0.04em] text-background sm:text-6xl lg:text-7xl">
                Build better learning
                <span className="block bg-gradient-to-r from-cyan-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent">
                  with AI and expert tutoring.
                </span>
              </h1>

              <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Justdy brings AI-powered educational creation, learning
                resources, and live tutoring together in one modern learning
                ecosystem.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={openSignup}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-background px-6 text-sm font-semibold text-foreground shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-background/90"
                >
                  Start creating with AI
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>

                <Link
                  href="/tutoring"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-background/[0.06] px-6 text-sm font-semibold text-background backdrop-blur transition hover:bg-background/[0.1]"
                >
                  <Video className="h-4 w-4" />
                  Find a tutor
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-300" />
                  Create faster
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-300" />
                  Learn smarter
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-300" />
                  Get expert help
                </span>
              </div>
            </div>

            {/* PRODUCT PREVIEW */}
            <div className="mx-auto mt-16 max-w-6xl">
              <div className="rounded-3xl border border-white/10 bg-background/[0.06] p-2 shadow-2xl shadow-black/30 backdrop-blur">
                <div className="overflow-hidden rounded-[22px] border border-border/10 bg-slate-900">
                  <div className="flex h-12 items-center border-b border-white/10 px-4">
                    <div className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-background/20" />
                      <span className="h-2.5 w-2.5 rounded-full bg-background/20" />
                      <span className="h-2.5 w-2.5 rounded-full bg-background/20" />
                    </div>

                    <div className="mx-auto rounded-lg border border-white/10 bg-background/[0.04] px-4 py-1 text-xs text-muted-foreground">
                      justdy.com
                    </div>

                    <div className="w-10" />
                  </div>

                  <div className="grid min-h-[380px] lg:grid-cols-[220px_1fr]">
                    <div className="hidden border-r border-white/10 bg-background/[0.025] p-5 lg:block">
                      <div className="mb-7 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-foreground">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-background">
                          Justdy
                        </span>
                      </div>

                      <div className="space-y-2">
                        {["AI Workspace", "Create", "Library", "Projects"].map(
                          (item, index) => (
                            <div
                              key={item}
                              className={`rounded-lg px-3 py-2 text-sm ${
                                index === 0
                                  ? "bg-background/10 text-background"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {item}
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="p-6 sm:p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
                            AI Workspace
                          </p>
                          <h2 className="mt-2 text-2xl font-semibold text-background">
                            What would you like to create?
                          </h2>
                        </div>

                        <div className="hidden rounded-xl border border-white/10 bg-background/[0.04] px-3 py-2 text-xs text-muted-foreground sm:block">
                          AI Copilot
                        </div>
                      </div>

                      <div className="mt-8 rounded-2xl border border-white/10 bg-background/[0.035] p-4">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-brfrom-cyan-400 to-indigo-500 text-background">
                            <Sparkles className="h-5 w-5" />
                          </div>

                          <div className="flex-1">
                            <p className="text-sm leading-6 text-slate-300">
                              Create a Grade 4 mathematics worksheet about
                              fractions with examples, practice questions, and
                              an answer key.
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                          <div className="flex gap-2">
                            <span className="rounded-lg bg-background/5 px-3 py-1.5 text-xs text-muted-foreground">
                              Grade 4
                            </span>
                            <span className="rounded-lg bg-background/5 px-3 py-1.5 text-xs text-muted-foreground">
                              Mathematics
                            </span>
                          </div>

                          <div className="rounded-lg bg-background px-4 py-2 text-xs font-semibold text-foreground">
                            Generate
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {[
                          ["Worksheet", "Create"],
                          ["Lesson", "Build"],
                          ["Quiz", "Generate"],
                        ].map(([title, action]) => (
                          <div
                            key={title}
                            className="rounded-xl border border-white/10 bg-background/[0.025] p-4"
                          >
                            <div className="text-sm font-medium text-background">
                              {title}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {action} with AI
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* POSITIONING */}
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                  One ecosystem
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Everything you need to move learning forward.
                </h2>
              </div>

              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                From creating educational content with AI to finding a tutor for
                one-on-one support, Justdy connects the tools people need to
                create, teach, learn, practice, and grow.
              </p>
            </div>
          </div>
        </section>

        {/* AUDIENCES */}
        <section className="bg-muted/40">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                Built for education
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                One platform. Different learning needs.
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Justdy supports the people who make learning happen every day.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {audiences.map((audience) => {
                const Icon = audience.icon;

                return (
                  <div
                    key={audience.title}
                    className="group rounded-2xl border border-border bg-background p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
                      <Icon className="h-5 w-5" />
                    </div>

                    <h3 className="mt-5 text-lg font-semibold text-foreground">
                      {audience.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {audience.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* AI CREATION */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
                  <Sparkles className="h-5 w-5" />
                </div>

                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                  Justdy AI
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Turn an idea into an educational resource.
                </h2>

                <p className="mt-5 text-lg leading-8 text-muted-foreground">
                  Stop starting from a blank page. Use AI to create useful
                  educational materials faster, then refine them to fit your
                  exact needs.
                </p>

                <Link
                  href="/dashboard"
                  className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  Explore AI creation
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {aiTools.map((tool) => {
                  const Icon = tool.icon;

                  return (
                    <Link
                      key={tool.title}
                      href={tool.href}
                      className="group rounded-2xl border border-border bg-background p-6 shadow-sm transition hover:-translate-y-1 hover:border-border hover:shadow-xl"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
                          <Icon className="h-5 w-5" />
                        </div>

                        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-muted-foreground" />
                      </div>

                      <h3 className="mt-5 font-semibold text-foreground">
                        {tool.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {tool.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                Simple workflow
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                From idea to impact in minutes.
              </h2>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="relative rounded-2xl border border-border bg-background p-7"
                >
                  <span className="text-sm font-bold text-indigo-600">
                    {step.number}
                  </span>

                  <h3 className="mt-5 text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TUTORING */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
            <div className="overflow-hidden rounded-3xl bg-foreground">
              <div className="grid lg:grid-cols-2">
                <div className="p-8 sm:p-12 lg:p-14">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background text-foreground">
                    <Video className="h-5 w-5" />
                  </div>

                  <p className="mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    Live tutoring
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-background sm:text-4xl">
                    When AI isn&apos;t enough, get a real person.
                  </h2>

                  <p className="mt-5 text-lg leading-8 text-slate-300">
                    Book a live one-on-one tutoring session with a verified
                    tutor. Learn face-to-face with live video and a shared
                    whiteboard.
                  </p>

                  <Link
                    href="/tutoring"
                    className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-background px-5 text-sm font-semibold text-foreground transition hover:bg-muted"
                  >
                    Book live tutoring
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="relative min-h-[330px] overflow-hidden border-t border-white/10 lg:border-l lg:border-t-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-cyan-400/10" />

                  <div className="absolute left-8 top-10 w-[calc(100%-4rem)] rounded-2xl border border-white/10 bg-background/[0.06] p-5 shadow-2xl backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Upcoming session
                        </p>
                        <p className="mt-1 font-semibold text-background">
                          Mathematics · Grade 6
                        </p>
                      </div>

                      <div className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300">
                        Scheduled
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                        <p className="text-xs text-muted-foreground">Tutor</p>
                        <p className="mt-1 text-sm font-medium text-background">
                          Verified tutor
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                        <p className="text-xs text-muted-foreground">Format</p>
                        <p className="mt-1 text-sm font-medium text-background">
                          Live video
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-background/[0.03] px-4 py-3">
                      <MessageSquareText className="h-4 w-4 text-cyan-300" />
                      <span className="text-xs text-muted-foreground">
                        Shared whiteboard available during the session
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-[-35px] right-[-35px] h-40 w-40 rounded-full border border-cyan-300/10 bg-cyan-300/5 blur-2xl" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RESOURCE ECOSYSTEM */}
        <section className="bg-muted/40">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                  Learning resources
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Discover resources that make learning easier.
                </h2>

                <p className="mt-5 text-lg leading-8 text-muted-foreground">
                  Combine AI-powered creation with quality educational
                  resources. Find materials for teaching, practice, revision,
                  and continued learning.
                </p>

                <Link
                  href="/products"
                  className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  Explore resources
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    icon: FileText,
                    title: "Worksheets",
                    text: "Practice and printable resources",
                  },
                  {
                    icon: BookOpen,
                    title: "Learning content",
                    text: "Resources for different needs",
                  },
                  {
                    icon: Brain,
                    title: "AI-generated",
                    text: "Create exactly what you need",
                  },
                  {
                    icon: Zap,
                    title: "Instant access",
                    text: "Get started without the wait",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-border bg-background p-5 shadow-sm"
                    >
                      <Icon className="h-5 w-5 text-indigo-600" />

                      <h3 className="mt-4 text-sm font-semibold text-foreground">
                        {item.title}
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bg-background">
          <div className="mx-auto max-w-5xl px-6 py-24 text-center sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>

            <h2 className="mt-7 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              The future of learning starts with a better toolkit.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Create with AI, discover educational resources, and connect with
              tutors—all through one learning ecosystem.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openSignup}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition hover:bg-foreground/90"
              >
                Start with Justdy
                <ArrowRight className="h-4 w-4" />
              </button>

              <Link
                href="/tutoring"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 text-sm font-semibold text-foreground transition hover:bg-muted/40"
              >
                Explore tutoring
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode={authMode}
      />
    </div>
  );
}
