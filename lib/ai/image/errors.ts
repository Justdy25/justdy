export class AIImageError extends Error {
  code: string;

  constructor(message: string, code = "IMAGE_GENERATION_ERROR") {
    super(message);
    this.name = "AIImageError";
    this.code = code;
  }
}
