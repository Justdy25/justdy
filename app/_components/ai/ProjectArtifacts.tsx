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
  RefreshCw,
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
  generationId: string | null;
  generation: {
    id: string;
    type: string;
    status: string;
    prompt: string;
    model: string | null;
    createdAt: string;
    completedAt: string | null;
  } | null;
  metadata: unknown;
};

type ResponseShape = {
  assets?: Artifact[];
  pagination?: { hasMore?: boolean; nextCursor?: string | null };
  project?: { id: string; name: string };
  error?: string;
};

function iconFor(type: AssetType) {
  if (type === "IMAGE") return ImageIcon;
  if (type === "VIDEO") return Video;
  if (type === "AUDIO") return AudioLines;
  return FileText;
}

function artifactHref(asset: Artifact) {
  if (
    asset.metadata &&
    typeof asset.metadata === "object" &&
    !Array.isArray(asset.metadata)
  ) {
    const editorPath = (asset.metadata as { editorPath?: unknown }).editorPath;
    if (typeof editorPath === "string" && editorPath.startsWith("/"))
      return editorPath;
  }
  if (asset.type === "IMAGE" && asset.url) return asset.url;
  if (asset.type === "VIDEO" && asset.generationId)
    return `/api/ai/video/${encodeURIComponent(asset.generationId)}/content`;
  return "/library";
}

export default function ProjectArtifacts({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<Artifact[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextCursor: string | null = null) => {
      if (nextCursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ limit: "24" });
        if (nextCursor) query.set("cursor", nextCursor);
        const response = await fetch(
          `/api/ai/projects/${encodeURIComponent(projectId)}/artifacts?${query.toString()}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as ResponseShape;
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load project artifacts.");
        setAssets((current) =>
          nextCursor
            ? [...current, ...(data.assets ?? [])]
            : (data.assets ?? []),
        );
        setHasMore(Boolean(data.pagination?.hasMore));
        setCursor(data.pagination?.nextCursor ?? null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load project artifacts.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  if (loading)
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Project artifacts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything generated for this project.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Library <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          {error}
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          Generate something in this project and it will appear here.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => {
              const Icon = iconFor(asset.type);
              const href = artifactHref(asset);
              const external = href.startsWith("http");
              return (
                <Link
                  key={asset.id}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className="group overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {asset.type === "IMAGE" && asset.url ? (
                      <img
                        src={asset.thumbnailUrl ?? asset.url}
                        alt={asset.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : asset.type === "VIDEO" ? (
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
                      {asset.type === "DOCUMENT"
                        ? "Document"
                        : asset.type.charAt(0) +
                          asset.type.slice(1).toLowerCase()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          {hasMore && cursor ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void load(cursor)}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="size-4 animate-spin" />}{" "}
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
