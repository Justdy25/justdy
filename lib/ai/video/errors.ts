export class AIVideoError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_REQUEST"
      | "PROVIDER_ERROR"
      | "NOT_FOUND"
      | "UNSUPPORTED"
      | "UNKNOWN" = "UNKNOWN",
  ) {
    super(message);
    this.name = "AIVideoError";
  }
}
