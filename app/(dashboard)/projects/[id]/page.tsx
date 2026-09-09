/* eslint-disable @next/next/no-img-element */
"use client";
import ProjectArtifacts from "@/app/_components/ai/ProjectArtifacts";
import ProjectContextPanel from "@/app/_components/ai/ProjectContextPanel";
import ProjectContextIndicator from "@/app/_components/ai/ProjectContextIndicator";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  ClipboardCheck,
  FileText,
  FolderKanban,
  ImageIcon,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Presentation,
  Sparkles,
  Video,
  WandSparkles,
  Youtube,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/app/_components/ui/button";
import { Card, CardContent } from "@/app/_components/ui/card";
import { Input } from "@/app/_components/ui/input";

type ProjectType =
  | "GENERAL"
  | "WORKSHEET"
  | "WORKBOOK"
  | "LESSON"
  | "QUIZ"
  | "PRESENTATION"
  | "YOUTUBE"
  | "JUSTDY_KIDZ";

type GenerationType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "WORKSHEET"
  | "WORKBOOK"
  | "QUIZ"
  | "LESSON_PLAN"
  | "PRESENTATION"
  | "STORY"
  | "THUMBNAIL";

type AssetType = "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO" | "OTHER";

type Project = {
  id: string;
  name: string;
  description: string | null;
  type: ProjectType;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  createdAt: string;
  updatedAt: string;
  _count: {
    assets: number;
    conversations: number;
    generations: number;
  };
  conversations: Conversation[];
  generations: Generation[];
  assets: Asset[];
};

type Conversation = {
  id: string;
  title: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

type Generation = {
  id: string;
  type: GenerationType;
  operation:
    | "CHAT"
    | "RESEARCH"
    | "IMAGE"
    | "VIDEO"
    | "AUDIO"
    | "DOCUMENT"
    | "WORKSHEET"
    | "QUIZ"
    | "LESSON_PLAN"
    | "PRESENTATION";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  prompt: string;
  provider: string | null;
  model: string | null;
  creditsUsed: number;
  createdAt: string;
  completedAt: string | null;
  assets: Asset[];
};

type Asset = {
  id: string;
  type: AssetType;
  name: string;
  url: string | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileSize?: number | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt?: string;
};

type ProjectResponse = {
  success: boolean;
  project: Project;
};

function getCreateActions(projectId: string) {
  const encodedProjectId = encodeURIComponent(projectId);

  return [
    {
      label: "Chat",
      description: "Work with Justdy AI",
      href: `/chat?projectId=${encodedProjectId}`,
      icon: MessageSquare,
    },
    {
      label: "Worksheet",
      description: "Create a worksheet",
      href: `/create/worksheet?projectId=${encodedProjectId}`,
      icon: FileText,
    },
    {
      label: "Image",
      description: "Generate an image",
      href: `/create/image?projectId=${encodedProjectId}`,
      icon: ImageIcon,
    },
    {
      label: "Video",
      description: "Generate a video",
      href: `/create/video?projectId=${encodedProjectId}`,
      icon: Video,
    },
  ];
}

function getProjectTypeLabel(type: ProjectType) {
  const labels: Record<ProjectType, string> = {
    GENERAL: "General",
    WORKSHEET: "Worksheet",
    WORKBOOK: "Workbook",
    LESSON: "Lesson",
    QUIZ: "Quiz",
    PRESENTATION: "Presentation",
    YOUTUBE: "YouTube",
    JUSTDY_KIDZ: "Justdy Kidz",
  };

  return labels[type];
}

function GenerationTypeIcon({
  type,
  className,
}: {
  type: Generation["type"];
  className?: string;
}) {
  switch (type) {
    case "VIDEO":
      return <Video className={className} />;

    case "IMAGE":
      return <ImageIcon className={className} />;

    case "AUDIO":
      return <AudioLines className={className} />;

    case "WORKSHEET":
      return <ClipboardCheck className={className} />;

    case "DOCUMENT":
      return <FileText className={className} />;

    case "QUIZ":
      return <ClipboardCheck className={className} />;

    case "LESSON_PLAN":
      return <BookOpen className={className} />;

    default:
      return <Sparkles className={className} />;
  }
}

function getGenerationLabel(type: GenerationType) {
  const labels: Record<GenerationType, string> = {
    TEXT: "Text",
    IMAGE: "Image",
    VIDEO: "Video",
    AUDIO: "Audio",
    DOCUMENT: "Document",
    WORKSHEET: "Worksheet",
    WORKBOOK: "Workbook",
    QUIZ: "Quiz",
    LESSON_PLAN: "Lesson plan",
    PRESENTATION: "Presentation",
    STORY: "Story",
    THUMBNAIL: "Thumbnail",
  };

  return labels[type];
}

function ProjectTypeIcon({
  type,
  className,
}: {
  type?: Project["type"] | null;
  className?: string;
}) {
  switch (type) {
    case "WORKSHEET":
      return <ClipboardCheck className={className} />;

    case "WORKBOOK":
      return <BookOpen className={className} />;

    case "LESSON":
      return <BookOpen className={className} />;

    case "QUIZ":
      return <ClipboardCheck className={className} />;

    case "PRESENTATION":
      return <Presentation className={className} />;

    case "YOUTUBE":
      return <Youtube className={className} />;

    case "JUSTDY_KIDZ":
      return <Sparkles className={className} />;

    default:
      return <FolderKanban className={className} />;
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelative(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Date.now() - date.getTime();

  if (diff < 60_000) {
    return "just now";
  }

  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m ago`;
  }

  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }

  if (diff < 604_800_000) {
    return `${Math.floor(diff / 86_400_000)}d ago`;
  }

  return formatDate(value);
}

function getStatusClass(status: Generation["status"]) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700";

    case "FAILED":
      return "bg-red-50 text-red-700";

    case "PROCESSING":
      return "bg-blue-50 text-blue-700";

    case "CANCELLED":
      return "bg-slate-100 text-slate-600";

    default:
      return "bg-amber-50 text-amber-700";
  }
}

function GenerationCard({ generation }: { generation: Generation }) {
  const previewAsset = generation.assets[0];

  return (
    <Card className="overflow-hidden border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm">
      {previewAsset?.url && previewAsset.type === "IMAGE" && (
        <div className="aspect-[16/9] overflow-hidden bg-slate-100">
          <img
            src={previewAsset.url}
            alt={previewAsset.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <GenerationTypeIcon
              type={generation.type}
              className="h-4 w-4 text-slate-600"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">
                {getGenerationLabel(generation.type)}
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusClass(
                  generation.status,
                )}`}
              >
                {generation.status.toLowerCase()}
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-800">
              {generation.prompt}
            </p>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{formatRelative(generation.createdAt)}</span>

              <span>{generation.creditsUsed} credits</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  const isImage = asset.type === "IMAGE" && Boolean(asset.url);

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="aspect-square bg-slate-100">
        {isImage ? (
          <img
            src={asset.thumbnailUrl || asset.url || ""}
            alt={asset.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileText className="h-8 w-8 text-slate-300" />
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-medium text-slate-800">
          {asset.name}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {asset.type.toLowerCase()} · {formatRelative(asset.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProject = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai/projects/${projectId}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as
        | ProjectResponse
        | { error?: string };

      if (!response.ok || !("success" in data) || !data.success) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to load project.",
        );
      }

      setProject(data.project);
      setEditName(data.project.name);
      setEditDescription(data.project.description || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load project.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProject();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadProject]);

  async function saveProject() {
    if (!project) {
      return;
    }

    const name = editName.trim();

    if (!name) {
      setError("Project name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: editDescription.trim() || null,
        }),
      });

      const data = (await response.json()) as
        | {
            success: true;
            project: Project;
          }
        | { error?: string };

      if (!response.ok || !("success" in data) || !data.success) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to update project.",
        );
      }

      setProject((current) =>
        current
          ? {
              ...current,
              ...data.project,
            }
          : current,
      );

      setEditing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update project.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 lg:px-10">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-8 w-64 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
          <div className="grid gap-5 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-5">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <FolderKanban className="h-6 w-6 text-slate-400" />
          </div>

          <h1 className="mt-5 text-xl font-semibold text-slate-900">
            Project unavailable
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {error || "This project could not be found."}
          </p>

          <Button className="mt-5" onClick={() => router.push("/projects")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 lg:px-10">
          <Link
            href="/projects"
            className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            All projects
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                <ProjectTypeIcon
                  type={project?.type}
                  className="h-7 w-7 text-slate-700"
                />
              </div>

              <div className="min-w-0">
                {editing ? (
                  <div className="max-w-xl space-y-3">
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      maxLength={200}
                      autoFocus
                    />

                    <textarea
                      value={editDescription}
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                      rows={3}
                      maxLength={2000}
                      placeholder="Project description"
                      className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void saveProject()}
                        disabled={saving}
                      >
                        {saving && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save changes
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        {project.name}
                      </h1>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {getProjectTypeLabel(project.type)}
                      </span>
                    </div>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      {project.description || "No project description yet."}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      Updated {formatRelative(project.updatedAt)}
                    </p>
                  </>
                )}
              </div>
            </div>

            {!editing && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>

                <Button
                  onClick={() =>
                    router.push(
                      `/chat?projectId=${encodeURIComponent(project.id)}`,
                    )
                  }
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create with AI
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ProjectContextIndicator
        projectId={project.id}
        className="mx-auto mt-6 max-w-[1600px]"
      />
      <section id="project-context" className="mt-8 scroll-mt-24">
        <ProjectContextPanel projectId={project.id} />
      </section>
      <section className="mt-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-slate-900" />

                <h2 className="text-lg font-semibold text-slate-900">
                  Create with Justdy AI
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Create new content directly inside this project.
              </p>
            </div>

            <Link
              href={`/chat?projectId=${encodeURIComponent(project.id)}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4" />
              Start creating with AI
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Link
              href={`/create/worksheet?projectId=${encodeURIComponent(project.id)}`}
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ClipboardCheck className="h-5 w-5 text-slate-600" />
              <span className="mt-2 block text-sm font-medium text-slate-800">
                Worksheet
              </span>
            </Link>

            <Link
              href={`/create/lesson?projectId=${encodeURIComponent(project.id)}`}
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <BookOpen className="h-5 w-5 text-slate-600" />
              <span className="mt-2 block text-sm font-medium text-slate-800">
                Lesson
              </span>
            </Link>

            <Link
              href={`/create/quiz?projectId=${encodeURIComponent(project.id)}`}
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ClipboardCheck className="h-5 w-5 text-slate-600" />
              <span className="mt-2 block text-sm font-medium text-slate-800">
                Quiz
              </span>
            </Link>

            <Link
              href={`/create/video?projectId=${encodeURIComponent(project.id)}`}
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Video className="h-5 w-5 text-slate-600" />
              <span className="mt-2 block text-sm font-medium text-slate-800">
                Video
              </span>
            </Link>

            <Link
              href={`/create/image?projectId=${encodeURIComponent(project.id)}`}
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ImageIcon className="h-5 w-5 text-slate-600" />
              <span className="mt-2 block text-sm font-medium text-slate-800">
                Image
              </span>
            </Link>

            <Link
              href={`/create/audio?projectId=${encodeURIComponent(project.id)}`}
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <AudioLines className="h-5 w-5 text-slate-600" />
              <span className="mt-2 block text-sm font-medium text-slate-800">
                Audio
              </span>
            </Link>

            <Link
              href={`/create/document?projectId=${encodeURIComponent(project.id)}`}
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FileText className="h-5 w-5 text-slate-600" />
              <span className="mt-2 block text-sm font-medium text-slate-800">
                Document
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <ProjectArtifacts projectId={project.id} />
      </section>
      <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-slate-200 bg-white">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                <WandSparkles className="h-5 w-5 text-slate-600" />
              </div>

              <div>
                <p className="text-2xl font-semibold text-slate-900">
                  {project._count.generations}
                </p>
                <p className="text-sm text-slate-500">AI creations</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                <ImageIcon className="h-5 w-5 text-slate-600" />
              </div>

              <div>
                <p className="text-2xl font-semibold text-slate-900">
                  {project._count.assets}
                </p>
                <p className="text-sm text-slate-500">Assets</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                <MessageSquare className="h-5 w-5 text-slate-600" />
              </div>

              <div>
                <p className="text-2xl font-semibold text-slate-900">
                  {project._count.conversations}
                </p>
                <p className="text-sm text-slate-500">Conversations</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Create something
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Start a new AI creation for this project.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {getCreateActions(project.id).map((action) => {
              const Icon = action.icon;

              return (
                <Link key={action.label} href={action.href} className="group">
                  <Card className="h-full border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                          <Icon className="h-5 w-5 text-slate-600" />
                        </div>

                        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700" />
                      </div>

                      <h3 className="mt-5 text-sm font-semibold text-slate-900">
                        {action.label}
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {action.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_360px]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Recent creations
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your latest AI generations in this project.
                </p>
              </div>
            </div>

            {project.generations.length === 0 ? (
              <Card className="border-dashed border-slate-300 bg-white">
                <CardContent className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                    <WandSparkles className="h-5 w-5 text-slate-400" />
                  </div>

                  <h3 className="mt-4 font-semibold text-slate-900">
                    No creations yet
                  </h3>

                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Start creating with Justdy AI and your generations will
                    appear here.
                  </p>

                  <Button
                    className="mt-5"
                    onClick={() =>
                      router.push(
                        `/chat?projectId=${encodeURIComponent(project.id)}`,
                      )
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Start creating
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {project.generations.map((generation) => (
                  <GenerationCard key={generation.id} generation={generation} />
                ))}
              </div>
            )}
          </section>

          <aside>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Conversations
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Recent AI conversations.
              </p>
            </div>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-2">
                {project.conversations.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <MessageSquare className="mx-auto h-6 w-6 text-slate-300" />

                    <p className="mt-3 text-sm font-medium text-slate-700">
                      No conversations yet
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Start a chat to begin.
                    </p>

                    <Link
                      href={`/chat?projectId=${encodeURIComponent(project.id)}`}
                      className="mt-4 inline-flex items-center text-xs font-medium text-slate-700 hover:underline"
                    >
                      Open Chat
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {project.conversations.map((conversation) => (
                      <Link
                        key={conversation.id}
                        href={`/chat?conversationId=${encodeURIComponent(conversation.id)}&projectId=${encodeURIComponent(project.id)}`}
                        className="block rounded-lg p-3 transition hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <MessageSquare className="h-4 w-4 text-slate-500" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {conversation.title || "Untitled conversation"}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {formatRelative(conversation.updatedAt)}
                            </p>
                          </div>

                          <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Project assets
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Files and media generated for this project.
              </p>
            </div>

            {project.assets.length > 0 && (
              <Link
                href={`/library?projectId=${encodeURIComponent(project.id)}`}
                className="hidden items-center text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline-flex"
              >
                View library
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            )}
          </div>

          {project.assets.length === 0 ? (
            <Card className="border-dashed border-slate-300 bg-white">
              <CardContent className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                </div>

                <h3 className="mt-4 font-semibold text-slate-900">
                  No assets yet
                </h3>

                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Generated images, videos, documents, and other files will
                  appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {project.assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
