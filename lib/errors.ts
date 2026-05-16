export type AppErrorKind =
  | "auth"
  | "tenant_scope"
  | "validation"
  | "provider"
  | "database"
  | "unknown";

export class AppError extends Error {
  kind: AppErrorKind;
  statusCode: number;
  safeMessage: string;

  constructor(kind: AppErrorKind, safeMessage: string, statusCode = 500, cause?: unknown) {
    super(safeMessage);
    this.name = "AppError";
    this.kind = kind;
    this.statusCode = statusCode;
    this.safeMessage = safeMessage;
    if (cause) {
      this.cause = cause;
    }
  }
}

export function toAppError(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("jwt") || message.includes("auth")) return new AppError("auth", "Please sign in again.", 401, error);
    if (message.includes("clinic") || message.includes("row-level") || message.includes("rls")) {
      return new AppError("tenant_scope", "You do not have access to this clinic record.", 403, error);
    }
    if (message.includes("required") || message.includes("invalid")) return new AppError("validation", error.message, 400, error);
    if (message.includes("twilio") || message.includes("resend") || message.includes("openai") || message.includes("stripe")) {
      return new AppError("provider", "External service unavailable. The action was saved and can be retried.", 502, error);
    }
    return new AppError("unknown", fallback, 500, error);
  }
  return new AppError("unknown", fallback, 500, error);
}

export function getSafeErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  return toAppError(error, fallback).safeMessage;
}
