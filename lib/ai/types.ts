export type AIMessageRole = "system" | "user" | "assistant";

export type AIInputContentPart =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_file";
      file_id: string;
      filename?: string;
    }
  | {
      type: "input_image";
      file_id: string;
      detail?: "low" | "high" | "auto";
    };

export type AIChatMessage = {
  role: AIMessageRole;
  content: string | AIInputContentPart[];
};

export type AIChatRequest = {
  messages: AIChatMessage[];
};

export type AIChatResponse = {
  text: string;
  provider: string;
  model: string;
};
