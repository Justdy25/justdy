export type AIToolCategory =
  | "CHAT"
  | "CREATE"
  | "RESEARCH"
  | "LEARN"
  | "EDUCATION"
  | "SOCIAL";

export type AITool =
  | "CHAT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "WRITING"
  | "PRESENTATION"
  | "RESEARCH"
  | "PDF"
  | "TUTOR"
  | "WORKSHEET"
  | "WORKBOOK"
  | "QUIZ"
  | "LESSON_PLAN"
  | "SOCIAL_POST"
  | "REEL"
  | "SHORT"
  | "THUMBNAIL"
  | "WEB_RESEARCH"
  | "STUDY_MODE"
  | "HOMEWORK_HELP"
  | "KNOWLEDGE_BASE"
  | "TEMPLATES"
  | "CAPTIONS"
  | "RESEARCH_REPORT"
  | "LIVE_TUTOR"
  | "CONTENT_IDEAS";

export interface AIToolDefinition {
  id: AITool;
  name: string;
  description: string;
  category: AIToolCategory;
  available: boolean;
  href?: string;
}

export const AI_TOOLS: AIToolDefinition[] = [
  {
    id: "CHAT",
    name: "AI Chat",
    description: "Ask questions, brainstorm, write, and solve problems.",
    category: "CHAT",
    available: true,
    href: "/chat",
  },

  {
    id: "IMAGE",
    name: "Image",
    description: "Create images from text prompts.",
    category: "CREATE",
    available: false,
  },

  {
    id: "VIDEO",
    name: "Video",
    description: "Create videos, reels, and visual stories.",
    category: "CREATE",
    available: true,
    href: "/create/video",
  },

  {
    id: "AUDIO",
    name: "Audio",
    description: "Generate and work with AI audio.",
    category: "CREATE",
    available: false,
  },

  {
    id: "WRITING",
    name: "Writing",
    description: "Write, rewrite, expand, summarize, and edit content.",
    category: "CREATE",
    available: false,
  },

  {
    id: "PRESENTATION",
    name: "Presentation",
    description: "Create professional presentations.",
    category: "CREATE",
    available: false,
  },

  {
    id: "RESEARCH",
    name: "Deep Research",
    description: "Research topics and produce structured reports.",
    category: "RESEARCH",
    available: false,
  },

  {
    id: "PDF",
    name: "Analyze PDF",
    description: "Ask questions and extract information from documents.",
    category: "RESEARCH",
    available: false,
  },

  {
    id: "TUTOR",
    name: "AI Tutor",
    description: "Learn through personalized AI tutoring.",
    category: "LEARN",
    available: false,
  },

  {
    id: "WORKSHEET",
    name: "Worksheet",
    description: "Create structured educational worksheets.",
    category: "EDUCATION",
    available: true,
    href: "/create/worksheet",
  },

  {
    id: "WORKBOOK",
    name: "Workbook",
    description: "Create complete educational workbooks.",
    category: "EDUCATION",
    available: false,
  },

  {
    id: "QUIZ",
    name: "Quiz",
    description: "Create quizzes and assessments.",
    category: "EDUCATION",
    available: false,
  },

  {
    id: "LESSON_PLAN",
    name: "Lesson Plan",
    description: "Create structured lesson plans.",
    category: "EDUCATION",
    available: false,
  },

  {
    id: "SOCIAL_POST",
    name: "Social Post",
    description: "Create social media posts and captions.",
    category: "SOCIAL",
    available: false,
  },

  {
    id: "REEL",
    name: "Reel",
    description: "Create short-form vertical videos.",
    category: "SOCIAL",
    available: false,
  },

  {
    id: "SHORT",
    name: "Short",
    description: "Create YouTube Shorts and similar content.",
    category: "SOCIAL",
    available: false,
  },

  {
    id: "THUMBNAIL",
    name: "Thumbnail",
    description: "Create high-impact video thumbnails.",
    category: "SOCIAL",
    available: false,
  },

  {
    id: "WEB_RESEARCH",
    name: "Web Research",
    description: "Explore information across the web.",
    category: "RESEARCH",
    available: false,
  },

  {
    id: "STUDY_MODE",
    name: "Study Mode",
    description: "Learn concepts through guided explanations and questions.",
    category: "LEARN",
    available: false,
  },

  {
    id: "HOMEWORK_HELP",
    name: "Homework Help",
    description: "Work through problems step by step.",
    category: "LEARN",
    available: false,
  },

  {
    id: "KNOWLEDGE_BASE",
    name: "Knowledge Base",
    description: "Learn from your own documents and materials.",
    category: "LEARN",
    available: false,
  },

  {
    id: "TEMPLATES",
    name: "Templates",
    description: "Create reusable teaching materials.",
    category: "EDUCATION",
    available: false,
  },

  {
    id: "CAPTIONS",
    name: "Captions",
    description: "Generate engaging captions.",
    category: "SOCIAL",
    available: false,
  },

  {
    id: "CONTENT_IDEAS",
    name: "Content Ideas",
    description: "Generate ideas and hooks.",
    category: "SOCIAL",
    available: false,
  },
  {
    id: "RESEARCH_REPORT",
    name: "Research Reports",
    description:
      "Turn research into structured reports with sources and findings.",
    category: "RESEARCH",
    available: false,
  },
  {
    id: "LIVE_TUTOR",
    name: "Live AI Tutor",
    description:
      "Learn interactively with voice, visuals, and guided instruction.",
    category: "LEARN",
    available: false,
  },
];

export function getAITool(tool: AITool) {
  return AI_TOOLS.find((item) => item.id === tool);
}

export function getAIToolsByCategory(category: AIToolCategory) {
  return AI_TOOLS.filter((item) => item.category === category);
}
