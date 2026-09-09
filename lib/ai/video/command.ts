import type { VideoAspectRatio, VideoDuration, VideoModel } from "./types";

export interface ParsedVideoCommand {
  duration: VideoDuration;
  aspectRatio: VideoAspectRatio;
  model: VideoModel;
  prompt: string;
}

function detectDuration(text: string): VideoDuration {
  const match = text.match(/\b(4|8|12)\s*(?:second|seconds|sec|secs)\b/i);

  if (!match) {
    return 8;
  }

  return Number(match[1]) as VideoDuration;
}

function detectAspectRatio(text: string): VideoAspectRatio {
  if (/\b(9\s*:\s*16|vertical|portrait)\b/i.test(text)) {
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
  return {
    prompt: prompt.trim(),
    duration: detectDuration(prompt),
    aspectRatio: detectAspectRatio(prompt),
    model: detectModel(prompt),
  };
}
