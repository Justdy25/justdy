"use client";

import Link from "next/link";
import { AI_TOOLS, type AITool } from "@/lib/ai/tools";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Brain,
  CheckSquare,
  FileImage,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Instagram,
  Layers3,
  Library,
  Mic,
  PenLine,
  Play,
  Presentation,
  Search,
  Sparkles,
  Video,
  Youtube,
} from "lucide-react";

const AI_TOOL_ICONS: Record<AITool, typeof Sparkles> = {
  CHAT: Sparkles,

  IMAGE: ImageIcon,
  VIDEO: Video,
  AUDIO: Mic,
  WRITING: PenLine,
  PRESENTATION: Presentation,

  RESEARCH: Search,
  WEB_RESEARCH: Globe,
  PDF: FileText,

  TUTOR: Brain,
  STUDY_MODE: BookOpen,
  HOMEWORK_HELP: GraduationCap,
  KNOWLEDGE_BASE: Library,

  WORKSHEET: FileText,
  WORKBOOK: BookOpenCheck,
  QUIZ: CheckSquare,
  LESSON_PLAN: GraduationCap,
  TEMPLATES: Layers3,

  SOCIAL_POST: PenLine,
  REEL: Instagram,
  SHORT: Youtube,
  THUMBNAIL: ImageIcon,
  CAPTIONS: FileText,
  CONTENT_IDEAS: Sparkles,
  RESEARCH_REPORT: FileText,
  LIVE_TUTOR: Brain,
};

function getTool(toolId: AITool) {
  return AI_TOOLS.find((tool) => tool.id === toolId);
}

/* ============================================================
   TYPES
============================================================ */

type DashboardProject = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    generations: number;
    assets: number;
  };
};

type DashboardGeneration = {
  id: string;
  type: string;
  status: string;
  prompt: string;
  provider: string | null;
  model: string | null;
  creditsUsed: number;
  createdAt: Date;
  completedAt: Date | null;
  projectId: string | null;
  project: {
    id: string;
    name: string;
    type: string;
  } | null;
  assets: {
    id: string;
    type: string;
    name: string;
    url: string | null;
    thumbnailUrl: string | null;
    mimeType: string | null;
  }[];
};

type DashboardData = {
  projects: DashboardProject[];
  generations: DashboardGeneration[];
};

interface JustdyAIStudioProps {
  dashboardData: DashboardData;
}

/* ============================================================
   TOOL CARD
============================================================ */

interface ToolCardProps {
  toolId: AITool;
  className?: string;
}

function AIToolIcon({
  toolId,
  className,
}: {
  toolId: AITool;
  className?: string;
}) {
  const Icon = AI_TOOL_ICONS[toolId] ?? Sparkles;

  return <Icon className={className} />;
}

function ToolCard({ toolId, className }: ToolCardProps) {
  const tool = getTool(toolId);

  if (!tool) return null;

  const content = (
    <div
      className={[
        "group relative h-full rounded-2xl border border-border/60",
        "bg-card/70 p-5 transition-all duration-200",
        tool.available
          ? "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
          : "opacity-80",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AIToolIcon toolId={toolId} className="h-5 w-5" />
        </div>

        {!tool.available && (
          <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Coming soon
          </span>
        )}
      </div>

      <div className="mt-4">
        <h3 className="font-semibold tracking-tight">{tool.name}</h3>

        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {tool.description}
        </p>
      </div>

      {tool.available && (
        <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
          Open tool
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </div>
  );

  if (!tool.available || !tool.href) {
    return <div className="h-full">{content}</div>;
  }

  return (
    <Link href={tool.href} className="block h-full">
      {content}
    </Link>
  );
}

/* ============================================================
   SECTION HEADER
============================================================ */

function SectionHeader({
  title,
  description,
  href,
}: {
  title: string;
  description?: string;
  href?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>

      {href && (
        <Link
          href={href}
          className="hidden items-center gap-1 text-xs font-semibold text-primary sm:flex"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/* ============================================================
   PROJECT CARD
============================================================ */

function ProjectCard({ project }: { project: DashboardProject }) {
  return (
    <Link
      href={`/manage/ai/projects/${project.id}`}
      className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <FolderKanban className="h-5 w-5" />
        </div>

        <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>

      <h3 className="mt-4 truncate text-sm font-bold text-slate-950 dark:text-white">
        {project.name}
      </h3>

      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {project.description || "AI project"}
      </p>

      <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-400">
        <span>{project._count.generations} generations</span>
        <span>•</span>
        <span>{project._count.assets} assets</span>
      </div>
    </Link>
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function JustdyAIStudio({ dashboardData }: JustdyAIStudioProps) {
  const projects = dashboardData.projects ?? [];
  const generations = dashboardData.generations ?? [];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] dark:bg-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ======================================================
            HERO
        ====================================================== */}

        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

          <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
            <div className="max-w-4xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Justdy AI
              </div>

              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                Your AI workspace for everything.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500 dark:text-slate-400 sm:text-lg">
                Create content, research ideas, learn with AI, build educational
                resources, and turn your ideas into finished work.
              </p>

              {/* AI PROMPT */}

              <div className="mt-8 max-w-3xl">
                <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm sm:flex-row dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex min-h-12 flex-1 items-center gap-3 rounded-xl bg-white px-4 dark:bg-slate-900">
                    <Sparkles className="h-4 w-4 shrink-0 text-primary" />

                    <span className="text-sm text-slate-400">
                      What do you want to create, learn, or research?
                    </span>
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    <Sparkles className="h-4 w-4" />
                    Start
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    "Research a topic",
                    "Create a video",
                    "Write something",
                    "Create a worksheet",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================
            QUICK START
        ====================================================== */}

        <section className="mt-10">
          <SectionHeader
            title="Start with something"
            description="Choose a workflow or jump straight into a tool."
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ToolCard toolId="CHAT" />

            <ToolCard toolId="RESEARCH" />

            <ToolCard toolId="IMAGE" />

            <ToolCard toolId="LIVE_TUTOR" />
          </div>
        </section>

        {/* ======================================================
            CREATE
        ====================================================== */}

        <section className="mt-12">
          <SectionHeader
            title="Create"
            description="Turn ideas into finished content."
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <ToolCard toolId="VIDEO" />
            <ToolCard toolId="IMAGE" />
            <ToolCard toolId="WRITING" />
            <ToolCard toolId="PRESENTATION" />
            <ToolCard toolId="AUDIO" />
          </div>
        </section>

        {/* ======================================================
            RESEARCH
        ====================================================== */}

        <section className="mt-12">
          <SectionHeader
            title="Research"
            description="Go beyond simple answers."
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ToolCard toolId="RESEARCH" />
            <ToolCard toolId="WEB_RESEARCH" />
            <ToolCard toolId="PDF" />
            <ToolCard toolId="RESEARCH_REPORT" />
          </div>
        </section>

        {/* ======================================================
            LEARN
        ====================================================== */}

        <section className="mt-12">
          <SectionHeader
            title="Learn"
            description="Make AI your personal learning companion."
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ToolCard toolId="LIVE_TUTOR" />

            <ToolCard toolId="STUDY_MODE" />

            <ToolCard toolId="HOMEWORK_HELP" />

            <ToolCard toolId="KNOWLEDGE_BASE" />
          </div>
        </section>

        {/* ======================================================
            EDUCATION
        ====================================================== */}

        <section className="mt-12">
          <SectionHeader
            title="Education"
            description="Professional AI tools for teachers and educational creators."
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <ToolCard toolId="WORKSHEET" />

            <ToolCard toolId="WORKBOOK" />

            <ToolCard toolId="QUIZ" />

            <ToolCard toolId="LESSON_PLAN" />

            <ToolCard toolId="TEMPLATES" />
          </div>
        </section>

        {/* ======================================================
            SOCIAL
        ====================================================== */}

        <section className="mt-12">
          <SectionHeader
            title="Social"
            description="Create content for today's social platforms."
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <ToolCard toolId="REEL" />

            <ToolCard toolId="SHORT" />
            <ToolCard toolId="SOCIAL_POST" />

            <ToolCard toolId="CAPTIONS" />

            <ToolCard toolId="THUMBNAIL" />

            <ToolCard toolId="CONTENT_IDEAS" />
          </div>
        </section>

        {/* ======================================================
            PROJECTS
        ====================================================== */}

        <section className="mt-14">
          <SectionHeader
            title="Recent Projects"
            description="Continue where you left off."
            href="/manage/ai/projects"
          />

          {projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <FolderKanban className="mx-auto h-8 w-8 text-slate-300" />

              <h3 className="mt-4 text-sm font-bold text-slate-900 dark:text-white">
                No projects yet
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                Your AI projects will appear here as you create and work.
              </p>
            </div>
          )}
        </section>

        {/* ======================================================
            RECENT ACTIVITY
        ====================================================== */}

        <section className="mt-12 pb-12">
          <SectionHeader
            title="Recent AI Activity"
            description="Your latest generations and creations."
          />

          {generations.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {generations.slice(0, 8).map((generation, index) => (
                <div
                  key={generation.id}
                  className={`flex items-center gap-4 px-5 py-4 ${
                    index !== generations.slice(0, 8).length - 1
                      ? "border-b border-slate-100 dark:border-slate-800"
                      : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {generation.type === "VIDEO" ? (
                      <Play className="h-4 w-4" />
                    ) : generation.type === "IMAGE" ? (
                      <FileImage className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {generation.prompt}
                    </div>

                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {generation.project?.name || "General AI"}
                      {" • "}
                      {generation.type}
                    </div>
                  </div>

                  <div className="hidden shrink-0 text-[11px] text-slate-400 sm:block">
                    {generation.creditsUsed} credits
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <Sparkles className="mx-auto h-7 w-7 text-slate-300" />

              <p className="mt-3 text-sm font-medium text-slate-500">
                Your AI activity will appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
