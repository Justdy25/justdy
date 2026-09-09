import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  CheckSquare,
  FileText,
  ImageIcon,
  Sparkles,
  Video,
  WandSparkles,
} from "lucide-react";

type CreatePageProps = {
  searchParams: Promise<{
    projectId?: string;
  }>;
};

const creationTypes = [
  {
    title: "Worksheet",
    description: "Create beautiful, classroom-ready worksheets with AI.",
    href: "/create/worksheet",
    icon: CheckSquare,
    accent: "bg-blue-50 text-blue-600",
  },
  {
    title: "Lesson",
    description:
      "Build complete lessons with objectives, activities, and teaching materials.",
    href: "/create/lesson",
    icon: BookOpen,
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Quiz",
    description: "Create quizzes and assessments tailored to your learners.",
    href: "/create/quiz",
    icon: Sparkles,
    accent: "bg-violet-50 text-violet-600",
  },
  {
    title: "Video",
    description: "Turn an idea, lesson, or story into an engaging AI video.",
    href: "/create/video",
    icon: Video,
    accent: "bg-rose-50 text-rose-600",
  },
  {
    title: "Image",
    description:
      "Generate illustrations, graphics, educational visuals, and more.",
    href: "/create/image",
    icon: ImageIcon,
    accent: "bg-amber-50 text-amber-600",
  },
  {
    title: "Audio",
    description: "Create narration, voiceovers, explanations, and other audio.",
    href: "/create/audio",
    icon: AudioLines,
    accent: "bg-cyan-50 text-cyan-600",
  },
  {
    title: "Document",
    description:
      "Generate reports, handouts, guides, and professional documents.",
    href: "/create/document",
    icon: FileText,
    accent: "bg-indigo-50 text-indigo-600",
  },
];

function withProjectId(href: string, projectId: string | null) {
  if (!projectId) {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";

  return `${href}${separator}projectId=${encodeURIComponent(projectId)}`;
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const params = await searchParams;

  const projectId =
    typeof params.projectId === "string"
      ? params.projectId.trim() || null
      : null;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
        {/* Header */}
        <section className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
            <WandSparkles className="h-6 w-6 text-red-600" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            What do you want to create?
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">
            Choose a creation type to get started, or use Justdy AI to turn your
            idea into the right resource.
          </p>

          {projectId && (
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Creating inside your project
            </div>
          )}
        </section>

        {/* Creation grid */}
        <section className="mt-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creationTypes.map((creation) => {
              const Icon = creation.icon;
              const href = withProjectId(creation.href, projectId);

              return (
                <Link
                  key={creation.title}
                  href={href}
                  className="group relative flex min-h-[190px] flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${creation.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <ArrowRight className="h-5 w-5 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-slate-600" />
                  </div>

                  <div className="mt-auto pt-8">
                    <h2 className="text-lg font-semibold text-slate-950">
                      {creation.title}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {creation.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* AI fallback */}
        <section className="mt-10">
          <Link
            href={withProjectId("/dashboard", projectId)}
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 transition-colors hover:bg-slate-100"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <Sparkles className="h-5 w-5 text-red-600" />
              </div>

              <div>
                <p className="font-semibold text-slate-950">
                  Not sure what to choose?
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Tell Justdy AI what you want to make and let it guide you.
                </p>
              </div>
            </div>

            <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>
      </div>
    </div>
  );
}
