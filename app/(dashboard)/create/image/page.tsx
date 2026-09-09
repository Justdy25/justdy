"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProjectContextIndicator from "@/app/_components/ProjectContextIndicator";
import {
  Download,
  ImageIcon,
  Loader2,
  Maximize2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import Image from "next/image";

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

type ImageQuality = "auto" | "low" | "medium" | "high";

type ImageOutputFormat = "png" | "jpeg";

interface GeneratedImage {
  generationId: string;
  assetId: string;
  url: string;
  mimeType: string;
  model: string;
  size: ImageSize;
  quality: ImageQuality;
  prompt: string;
  status: string;
}

const SIZE_OPTIONS: Array<{
  value: ImageSize;
  label: string;
  description: string;
}> = [
  {
    value: "1024x1024",
    label: "Square",
    description: "1:1",
  },
  {
    value: "1536x1024",
    label: "Landscape",
    description: "Wide",
  },
  {
    value: "1024x1536",
    label: "Portrait",
    description: "Tall",
  },
];

const QUALITY_OPTIONS: Array<{
  value: ImageQuality;
  label: string;
}> = [
  {
    value: "auto",
    label: "Auto",
  },
  {
    value: "low",
    label: "Low",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "high",
    label: "High",
  },
];

const FORMAT_OPTIONS: Array<{
  value: ImageOutputFormat;
  label: string;
}> = [
  {
    value: "png",
    label: "PNG",
  },
  {
    value: "jpeg",
    label: "JPEG",
  },
];

const EXAMPLE_PROMPTS = [
  "A cinematic photograph of a golden retriever puppy running through a flower field at sunrise",
  "A futuristic city at night with flying cars, cinematic lighting and incredible detail",
  "A cozy modern cabin in the mountains surrounded by snow-covered pine trees",
  "A colorful children's storybook illustration of a little fox exploring an enchanted forest",
];

function createRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getImageDimensions(size: ImageSize): {
  width: number;
  height: number;
} {
  switch (size) {
    case "1024x1536":
      return {
        width: 1024,
        height: 1536,
      };

    case "1536x1024":
      return {
        width: 1536,
        height: 1024,
      };

    case "1024x1024":
    default:
      return {
        width: 1024,
        height: 1024,
      };
  }
}

function ImageCreationContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [prompt, setPrompt] = useState("");

  const [size, setSize] = useState<ImageSize>("1024x1024");

  const [quality, setQuality] = useState<ImageQuality>("auto");

  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>("png");

  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(
    null,
  );

  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [showLightbox, setShowLightbox] = useState(false);

  async function handleGenerate() {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError("Describe the image you want to create.");
      return;
    }

    if (generating) {
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          prompt: trimmedPrompt,
          model: "gpt-image-2",
          size,
          quality,
          outputFormat,
          background: "auto",
          requestId: createRequestId(),
          projectId: projectId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Image generation failed.",
        );
      }

      if (!data?.image) {
        throw new Error("The image generator returned no image.");
      }

      setGeneratedImage(data.image);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Image generation failed.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleExamplePrompt(example: string) {
    setPrompt(example);
    setError(null);
  }

  async function handleDownload() {
    if (!generatedImage?.url) {
      return;
    }

    try {
      const response = await fetch(generatedImage.url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to download image.");
      }

      const blob = await response.blob();

      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = objectUrl;

      anchor.download = `justdy-image-${generatedImage.assetId}.${outputFormat === "jpeg" ? "jpg" : "png"}`;

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch {
      /*
       * Fallback for environments that do not allow
       * fetching the CDN resource directly.
       */
      window.open(generatedImage.url, "_blank", "noopener,noreferrer");
    }
  }

  const generatedImageDimensions = generatedImage
    ? getImageDimensions(generatedImage.size)
    : getImageDimensions(size);

  return (
    <>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          {/* =====================================================
              HEADER
          ====================================================== */}

          <div className="mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <ImageIcon className="h-4.5 w-4.5" />
                  </div>

                  <span className="text-sm font-medium text-muted-foreground">
                    Justdy AI
                  </span>
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Create an image
                </h1>

                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Turn your ideas into high-quality images with AI.
                </p>

                {projectId && (
                  <ProjectContextIndicator
                    projectId={projectId}
                    compact
                    className="mt-4"
                  />
                )}
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
                <Sparkles className="h-3.5 w-3.5" />
                GPT-Image-2
              </div>
            </div>
          </div>

          {/* =====================================================
              MAIN WORKSPACE
          ====================================================== */}

          <div className="grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
            {/* ===================================================
                LEFT CONTROL PANEL
            ==================================================== */}

            <div className="h-fit overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <WandSparkles className="h-4 w-4 text-primary" />

                  <h2 className="text-sm font-semibold">Image settings</h2>
                </div>
              </div>

              <div className="space-y-6 p-5">
                {/* Prompt */}

                <div>
                  <label
                    htmlFor="image-prompt"
                    className="mb-2 block text-sm font-medium"
                  >
                    Describe your image
                  </label>

                  <textarea
                    id="image-prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        (event.metaKey || event.ctrlKey)
                      ) {
                        event.preventDefault();

                        void handleGenerate();
                      }
                    }}
                    placeholder="Describe the image you want to create..."
                    rows={7}
                    maxLength={10000}
                    disabled={generating}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Be descriptive for better results.
                    </p>

                    <span className="text-[11px] text-muted-foreground">
                      {prompt.length}/10000
                    </span>
                  </div>
                </div>

                {/* Size */}

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Aspect ratio
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {SIZE_OPTIONS.map((option) => {
                      const selected = size === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={generating}
                          onClick={() => setSize(option.value)}
                          className={`rounded-xl border px-2 py-3 text-center transition ${
                            selected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                          } disabled:pointer-events-none disabled:opacity-60`}
                        >
                          <span className="block text-xs font-medium">
                            {option.label}
                          </span>

                          <span className="mt-0.5 block text-[10px]">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quality */}

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Quality
                  </label>

                  <div className="grid grid-cols-4 gap-2">
                    {QUALITY_OPTIONS.map((option) => {
                      const selected = quality === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={generating}
                          onClick={() => setQuality(option.value)}
                          className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                            selected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted/50"
                          } disabled:pointer-events-none disabled:opacity-60`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Format */}

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Format
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {FORMAT_OPTIONS.map((option) => {
                      const selected = outputFormat === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={generating}
                          onClick={() => setOutputFormat(option.value)}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                            selected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted/50"
                          } disabled:pointer-events-none disabled:opacity-60`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Error */}

                {error && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3">
                    <p className="text-xs leading-5 text-destructive">
                      {error}
                    </p>
                  </div>
                )}

                {/* Generate */}

                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating || !prompt.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating image...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Create image
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] leading-4 text-muted-foreground">
                  Press ⌘ Enter to generate
                </p>
              </div>
            </div>

            {/* ===================================================
                RIGHT PREVIEW
            ==================================================== */}

            <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold">Preview</h2>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your generated image will appear here.
                  </p>
                </div>

                {generatedImage && (
                  <button
                    type="button"
                    onClick={() => setShowLightbox(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-medium transition hover:bg-muted"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Fullscreen
                  </button>
                )}
              </div>

              <div className="flex min-h-[560px] items-center justify-center bg-muted/20 p-4 sm:p-6">
                {generating ? (
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                      <Sparkles className="h-7 w-7 animate-pulse text-primary" />
                    </div>

                    <h3 className="text-sm font-semibold">
                      Creating your image
                    </h3>

                    <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                      Justdy AI is generating your image. This may take a
                      moment.
                    </p>

                    <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </div>
                  </div>
                ) : generatedImage ? (
                  <div className="w-full max-w-4xl">
                    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                      <Image
                        src={generatedImage.url}
                        alt={generatedImage.prompt || "Generated image"}
                        width={generatedImageDimensions.width}
                        height={generatedImageDimensions.height}
                        sizes="(max-width: 1024px) 100vw, 1024px"
                        className="mx-auto block h-auto max-h-[700px] w-full object-contain"
                      />
                    </div>

                    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">Generated image</p>

                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {generatedImage.size}
                          {" · "}
                          {generatedImage.quality}
                          {" · "}
                          {generatedImage.model}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDownload()}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium transition hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex max-w-md flex-col items-center justify-center text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                      <ImageIcon className="h-7 w-7 text-muted-foreground" />
                    </div>

                    <h3 className="text-sm font-semibold">
                      Your image will appear here
                    </h3>

                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      Describe what you want to create using the prompt on the
                      left.
                    </p>

                    <div className="mt-6 w-full text-left">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Try an example
                      </p>

                      <div className="space-y-2">
                        {EXAMPLE_PROMPTS.map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() => handleExamplePrompt(example)}
                            className="block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-left text-[11px] leading-4 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =====================================================
              FOOTER INFORMATION
          ====================================================== */}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold">Describe anything</p>

              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                Create illustrations, photos, artwork, concepts, scenes and
                more.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold">Multiple formats</p>

              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                Choose square, landscape or portrait dimensions for your
                project.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold">High-quality output</p>

              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                Generate polished images using Justdy AI.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          LIGHTBOX
      ========================================================== */}

      {showLightbox && generatedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowLightbox(false)}
        >
          <button
            type="button"
            aria-label="Close image preview"
            onClick={() => setShowLightbox(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="max-h-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={generatedImage.url}
              alt={generatedImage.prompt || "Generated image"}
              width={generatedImageDimensions.width}
              height={generatedImageDimensions.height}
              sizes="(max-width: 1536px) 100vw, 1536px"
              className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function ImageCreationPage() {
  return (
    <Suspense fallback={null}>
      <ImageCreationContent />
    </Suspense>
  );
}
