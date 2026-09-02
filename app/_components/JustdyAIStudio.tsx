"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckSquare,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Mic2,
  Presentation,
  Sparkles,
  Video,
} from "lucide-react";

type Tool = {
  title: string;
  description: string;
  icon: typeof FileText;
  status: "Available" | "Coming next";
  href?: string;
};

const tools: Tool[] = [
  {
    title: "Worksheet",
    description: "Create polished student worksheets and answer keys.",
    icon: FileText,
    status: "Available",
    href: "/manage/ai/worksheet",
  },
  {
    title: "Workbook",
    description: "Turn a topic into a structured multi-page workbook.",
    icon: BookOpenCheck,
    status: "Coming next",
  },
  {
    title: "Quiz",
    description: "Generate assessments with questions and answers.",
    icon: CheckSquare,
    status: "Coming next",
  },
  {
    title: "Lesson Plan",
    description: "Build classroom-ready lessons from a learning objective.",
    icon: LayoutDashboard,
    status: "Coming next",
  },
  {
    title: "Image",
    description: "Create educational illustrations and visual assets.",
    icon: ImageIcon,
    status: "Coming next",
  },
  {
    title: "Presentation",
    description: "Create lesson slides from your teaching topic.",
    icon: Presentation,
    status: "Coming next",
  },
  {
    title: "Voice",
    description: "Create narration for lessons and educational videos.",
    icon: Mic2,
    status: "Coming next",
  },
  {
    title: "Video",
    description: "Create educational videos with the existing Video Studio.",
    icon: Video,
    status: "Available",
    href: "/manage/ai-video",
  },
];

export default function JustdyAIStudio() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Hero */}
          <div className="relative overflow-hidden px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
            <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

            <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Justdy AI Studio
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
                Create educational content with AI.
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500 dark:text-slate-400 sm:text-lg">
                Turn an idea into worksheets, lessons, images, videos, and
                complete learning resources — all from one Justdy workspace.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/manage/ai/worksheet"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
                >
                  Create Worksheet
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/manage/ai-video"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Open Video Studio
                  <Video className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Tools */}
          <div className="border-t border-slate-100 px-6 py-7 dark:border-slate-800 sm:px-10 lg:px-12">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Create with Justdy AI
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                More generators will be connected to the same projects, assets,
                and credit system.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const available = tool.status === "Available";

                const content = <ToolCardContent tool={tool} Icon={Icon} />;

                if (available && tool.href) {
                  return (
                    <Link
                      key={tool.title}
                      href={tool.href}
                      className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={tool.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCardContent({
  tool,
  Icon,
}: {
  tool: Tool;
  Icon: typeof FileText;
}) {
  const available = tool.status === "Available";

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>

        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            available
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {tool.status}
        </span>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-slate-900 dark:text-white">
        {tool.title}
      </h3>

      <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {tool.description}
      </p>

      {available && (
        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
          Open Studio
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </>
  );
}
