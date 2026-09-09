import type { AIIntentResult } from "./types";

const VIDEO_PATTERNS = [
  /\bcreate\b.*\bvideo\b/i,
  /\bgenerate\b.*\bvideo\b/i,
  /\bmake\b.*\bvideo\b/i,
  /\bvideo\b.*\bcreate\b/i,
  /\bvideo\b.*\bgenerate\b/i,
  /\bfilm\b/i,
  /\bclip\b/i,
  /\bcinematic\b.*\bvideo\b/i,
];

const WORKSHEET_PATTERNS = [
  /\bcreate\b.*\bworksheet\b/i,
  /\bgenerate\b.*\bworksheet\b/i,
  /\bmake\b.*\bworksheet\b/i,
];

const IMAGE_PATTERNS = [
  /\bcreate\b.*\b(image|picture|photo|illustration|artwork)\b/i,
  /\bgenerate\b.*\b(image|picture|photo|illustration|artwork)\b/i,
  /\bmake\b.*\b(image|picture|photo|illustration|artwork)\b/i,
  /\bdraw\b.*\b(image|picture|illustration|artwork)\b/i,
  /\bdesign\b.*\b(image|picture|illustration|artwork)\b/i,
  /\bproduce\b.*\b(image|picture|photo|illustration|artwork)\b/i,
  /\b(generate|create|make)\s+(an?\s+)?image\b/i,
];

const AUDIO_PATTERNS = [
  /\bcreate\b.*\baudio\b/i,
  /\bgenerate\b.*\baudio\b/i,
  /\bvoiceover\b/i,
  /\bnarration\b/i,
];

const DOCUMENT_PATTERNS = [
  /\bcreate\b.*\bdocument\b/i,
  /\bgenerate\b.*\bdocument\b/i,
  /\bwrite\b.*\breport\b/i,
  /\bcreate\b.*\bpdf\b/i,
];

const QUIZ_PATTERNS = [
  /\bcreate\b.*\bquiz\b/i,
  /\bgenerate\b.*\bquiz\b/i,
  /\bmake\b.*\bquiz\b/i,
];

const LESSON_PATTERNS = [
  /\bcreate\b.*\blesson\b/i,
  /\bgenerate\b.*\blesson plan\b/i,
  /\bmake\b.*\blesson plan\b/i,
];

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function detectAIIntent(prompt: string): AIIntentResult {
  const text = prompt.trim();

  if (matchesAny(text, VIDEO_PATTERNS)) {
    return {
      intent: "VIDEO",
      confidence: 0.95,
      reasoning: "The request explicitly asks for video creation.",
    };
  }

  if (matchesAny(text, WORKSHEET_PATTERNS)) {
    return {
      intent: "WORKSHEET",
      confidence: 0.95,
      reasoning: "The request explicitly asks for a worksheet.",
    };
  }

  if (matchesAny(text, IMAGE_PATTERNS)) {
    return {
      intent: "IMAGE",
      confidence: 0.95,
      reasoning: "The request explicitly asks for image creation.",
    };
  }

  if (matchesAny(text, AUDIO_PATTERNS)) {
    return {
      intent: "AUDIO",
      confidence: 0.9,
      reasoning: "The request explicitly asks for audio creation.",
    };
  }

  if (matchesAny(text, DOCUMENT_PATTERNS)) {
    return {
      intent: "DOCUMENT",
      confidence: 0.9,
      reasoning: "The request explicitly asks for a document.",
    };
  }

  if (matchesAny(text, QUIZ_PATTERNS)) {
    return {
      intent: "QUIZ",
      confidence: 0.95,
      reasoning: "The request explicitly asks for a quiz.",
    };
  }

  if (matchesAny(text, LESSON_PATTERNS)) {
    return {
      intent: "LESSON_PLAN",
      confidence: 0.9,
      reasoning: "The request explicitly asks for a lesson.",
    };
  }

  return {
    intent: "CHAT",
    confidence: 0.8,
    reasoning: "No specialized creation intent was detected.",
  };
}
