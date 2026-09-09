"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AudioLines,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Play,
  Search,
  Sparkles,
  Video,
  X,
} from "lucide-react";

import { Button } from "@/app/_components/ui/button";
import { Input } from "@/app/_components/ui/input";

type HistoryType =
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

type HistoryStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | string;

type HistoryAsset = {
  id: string;
  type?: string | null;
  name?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
};

type HistoryProject = {
  id: string;
  name: string;
  type?: string | null;
};

type HistoryItem = {
  id: string;
  type: HistoryType | string;
  status: HistoryStatus;
  prompt: string;
  provider?: string | null;
  model?: string | null;
  creditsUsed?: number | null;
  createdAt: string;
  completedAt?: string | null;
  projectId?: string | null;
  project?: HistoryProject | null;
  assets?: HistoryAsset[];
  outputData?: unknown;
};

type HistoryResponse = {
  history?: HistoryItem[];
  items?: HistoryItem[];
  generations?: HistoryItem[];
  pagination?: {
    limit?: number;
    hasMore?: boolean;
    nextCursor?: string | null;
  };
  error?: string;
};

const HISTORY_TYPES: Array<{
  value: "ALL" | HistoryType;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "WORKSHEET", label: "Worksheets" },
  { value: "LESSON_PLAN", label: "Lessons" },
  { value: "QUIZ", label: "Quizzes" },
  { value: "VIDEO", label: "Videos" },
  { value: "IMAGE", label: "Images" },
  { value: "AUDIO", label: "Audio" },
  { value: "DOCUMENT", label: "Documents" },
];

function getTypeLabel(type: string) {
  const found = HISTORY_TYPES.find((item) => item.value === type);
  if (found) return found.label;

  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "WORKSHEET":
    case "WORKBOOK":
    case "QUIZ":
      return <ClipboardCheck className={className} />;
    case "LESSON_PLAN":
      return <BookOpen className={className} />;
    case "VIDEO":
      return <Video className={className} />;
    case "IMAGE":
    case "THUMBNAIL":
      return <ImageIcon className={className} />;
    case "AUDIO":
      return <AudioLines className={className} />;
    case "DOCUMENT":
    case "PRESENTATION":
      return <FileText className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

function StatusBadge({ status }: { status: HistoryStatus }) {
  const normalized = status.toUpperCase();

  if (normalized === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
        <CheckCircle2 className="size-3.5" />
        Completed
      </span>
    );
  }

  if (normalized === "PROCESSING" || normalized === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {normalized === "PENDING" ? "Queued" : "Processing"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <X className="size-3.5" />
      {getTypeLabel(status)}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Math.max(0, Date.now() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;

  return formatDate(value);
}

function getPromptTitle(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Untitled creation";
  if (cleaned.length <= 72) return cleaned;
  return `${cleaned.slice(0, 69)}...`;
}

function getPreviewAsset(item: HistoryItem) {
  return item.assets?.find((asset) => asset.thumbnailUrl || asset.url) ?? null;
}

function getOpenHref(item: HistoryItem) {
  if (item.type === "WORKSHEET") {
    return `/create/worksheet/editor?generationId=${encodeURIComponent(item.id)}`;
  }

  const asset = getPreviewAsset(item);

  if (asset?.url) return asset.url;

  return "/library";
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const asset = getPreviewAsset(item);
  const previewUrl = asset?.thumbnailUrl ?? asset?.url ?? null;
  const title = getPromptTitle(item.prompt);
  const completed = item.status.toUpperCase() === "COMPLETED";
  const href = getOpenHref(item);

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted/70">
        {previewUrl ? (
          item.type === "VIDEO" ? (
            <div className="relative h-full w-full">
              <Image
                src={previewUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover transition duration-300 group-hover:scale-[1.02]"
                unoptimized
              />
              <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                <span className="flex size-11 items-center justify-center rounded-full border border-border/80 bg-card/90 shadow-sm">
                  <Play className="ml-0.5 size-4 fill-current" />
                </span>
              </div>
            </div>
          ) : (
            <Image
              src={previewUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
              unoptimized
            />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <TypeIcon type={item.type} className="size-6" />
            </div>
            <span className="text-xs font-medium">
              {getTypeLabel(item.type)}
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            <TypeIcon type={item.type} className="size-3.5" />
            {getTypeLabel(item.type)}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
              {title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{formatRelativeDate(item.createdAt)}</span>
              {item.model ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{item.model}</span>
                </>
              ) : null}
            </div>
          </div>

          <StatusBadge status={item.status} />
        </div>

        {item.project?.name ? (
          <div className="mt-3 truncate rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
            {item.project.name}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {item.creditsUsed != null
              ? `${item.creditsUsed} credit${item.creditsUsed === 1 ? "" : "s"}`
              : completed
                ? "Ready"
                : "In progress"}
          </div>

          <Button asChild size="sm" variant="outline">
            <Link href={href}>Open</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [activeType, setActiveType] = useState<"ALL" | HistoryType>("ALL");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(
    async ({
      nextCursor = null,
      append = false,
    }: {
      nextCursor?: string | null;
      append?: boolean;
    } = {}) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "24");

        if (activeType !== "ALL") {
          params.set("type", activeType);
        }

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (nextCursor) {
          params.set("cursor", nextCursor);
        }

        const response = await fetch(`/api/ai/history?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = (await response.json()) as HistoryResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load your history.");
        }

        const nextItems = data.history ?? data.items ?? data.generations ?? [];

        setItems((current) =>
          append ? [...current, ...nextItems] : nextItems,
        );

        setHasMore(data.pagination?.hasMore ?? false);
        setCursor(data.pagination?.nextCursor ?? null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your history.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeType, search],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  const visibleItems = useMemo(() => items, [items]);

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                Your creation history
              </div>

              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                History
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Revisit the learning content you have created with Justdy.
              </p>
            </div>

            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard">
                <Sparkles className="mr-2 size-4" />
                New creation
              </Link>
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your creations..."
                className="h-10 border-border bg-background pl-9"
                aria-label="Search history"
              />
            </div>

            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">
              {HISTORY_TYPES.map((type) => {
                const active = activeType === type.value;

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setActiveType(type.value)}
                    className={[
                      "shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {error ? (
          <section className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-card">
              <X className="size-5 text-destructive" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              We could not load your history
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => void loadHistory()}
            >
              Try again
            </Button>
          </section>
        ) : loading ? (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-border/80 bg-card"
              >
                <div className="aspect-[16/10] animate-pulse bg-muted" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                  <div className="h-9 animate-pulse rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </section>
        ) : visibleItems.length === 0 ? (
          <section className="mt-8 flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-muted">
                {search || activeType !== "ALL" ? (
                  <Search className="size-6 text-muted-foreground" />
                ) : (
                  <LayoutGrid className="size-6 text-muted-foreground" />
                )}
              </div>

              <h2 className="mt-5 text-lg font-semibold text-foreground">
                {search || activeType !== "ALL"
                  ? "No creations found"
                  : "Your history is empty"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {search || activeType !== "ALL"
                  ? "Try a different search or creation type."
                  : "Create a worksheet, lesson, quiz, video, image, or other learning resource and it will appear here."}
              </p>

              {search || activeType !== "ALL" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setSearch("");
                    setActiveType("ALL");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button asChild className="mt-5">
                  <Link href="/dashboard">
                    <Sparkles className="mr-2 size-4" />
                    Start creating
                  </Link>
                </Button>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleItems.map((item) => (
                <HistoryCard key={item.id} item={item} />
              ))}
            </section>

            {hasMore && cursor ? (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() =>
                    void loadHistory({
                      nextCursor: cursor,
                      append: true,
                    })
                  }
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
