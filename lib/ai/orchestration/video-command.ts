import type {
  VideoAspectRatio,
  VideoDuration,
  VideoModel,
} from "@/lib/ai/video/types";

export interface ParsedVideoCommand {
  prompt: string;
  duration: VideoDuration;
  aspectRatio: VideoAspectRatio;
  model: VideoModel;
}

function detectDuration(text: string): VideoDuration {
  const match = text.match(/\b(4|8|12)\s*(?:second|seconds|sec|secs)\b/i);

  if (!match) {
    return 8;
  }

  return Number(match[1]) as VideoDuration;
}

function detectAspectRatio(text: string): VideoAspectRatio {
  if (
    /\b9\s*:\s*16\b/i.test(text) ||
    /\bvertical\b/i.test(text) ||
    /\bportrait\b/i.test(text)
  ) {
    return "9:16";
  }

  return "16:9";
}

function detectModel(text: string): VideoModel {
  if (/\bsora[\s-]*2[\s-]*pro\b/i.test(text)) {
    return "sora-2-pro";
  }

  return "sora-2";
}

export function parseVideoCommand(prompt: string): ParsedVideoCommand {
  const normalized = prompt.trim();

  return {
    prompt: normalized,
    duration: detectDuration(normalized),
    aspectRatio: detectAspectRatio(normalized),
    model: detectModel(normalized),
  };
}
