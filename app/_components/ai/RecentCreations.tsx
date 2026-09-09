/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  FileText,
  ImageIcon,
  Loader2,
  Play,
  Sparkles,
  Video,
} from "lucide-react";

type AssetType = "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO" | "OTHER";

type Artifact = {
  id: string;
  type: AssetType;
  name: string;
  url: string | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  generation: {
    id: string;
    type: string;
    status: string;
    prompt: string;
    model: string | null;
    createdAt: string;
  } | null;
  metadata: unknown;
};

type LibraryResponse = {
  assets?: Artifact[];
  pagination?: { hasMore?: boolean; nextCursor?: string | null };
};

function getArtifactPath(asset: Artifact) {
  const metadata = asset.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const editorPath = (metadata as { editorPath?: unknown }).editorPath;
    if (typeof editorPath === "string" && editorPath.startsWith("/")) {
      return editorPath;
    }
  }

  if (asset.type === "IMAGE" && asset.url) return asset.url;
  if (asset.type === "VIDEO" && asset.generation?.id) {
    return `/api/ai/video/${encodeURIComponent(asset.generation.id)}/content`;
  }

  return "/library";
}

function iconFor(type: AssetType) {
  if (type === "IMAGE") return ImageIcon;
  if (type === "VIDEO") return Video;
  if (type === "AUDIO") return AudioLines;
  return FileText;
}

function labelFor(type: AssetType) {
  if (type === "DOCUMENT") return "Document";
  if (type === "IMAGE") return "Image";
  if (type === "VIDEO") return "Video";
  if (type === "AUDIO") return "Audio";
  return "Creation";
}

export default function RecentCreations() {
  const [assets, setAssets] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/library?limit=6", {
        cache: "no-store",
      });
      const data = (await response.json()) as LibraryResponse & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Unable to load recent creations.");
      setAssets(data.assets ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load recent creations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    const onUpdated = () => void load();

    window.addEventListener("justdy:artifact-created", onUpdated);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("justdy:artifact-created", onUpdated);
    };
  }, [load]);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Recent creations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your latest AI-generated artifacts, all in one place.
          </p>
        </div>
        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View library <ArrowRight className="size-4" />
        </Link>
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center rounded-2xl border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          {error}
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <Sparkles className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="font-medium">No creations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate something with Justdy AI and it will appear here
            automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {assets.map((asset) => {
            const Icon = iconFor(asset.type);
            const href = getArtifactPath(asset);
            const isImage = asset.type === "IMAGE" && Boolean(asset.url);
            const isVideo =
              asset.type === "VIDEO" &&
              Boolean(asset.url || asset.generation?.id);

            return (
              <Link
                key={asset.id}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className="group overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {isImage ? (
                    <img
                      src={asset.thumbnailUrl ?? asset.url ?? undefined}
                      alt={asset.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : isVideo ? (
                    asset.thumbnailUrl ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Play className="size-8 text-muted-foreground" />
                      </div>
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Icon className="size-9 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{asset.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labelFor(asset.type)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
