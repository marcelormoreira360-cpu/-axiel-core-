/**
 * Structured logger for AXIEL Core.
 *
 * - Development / test: writes to console (unchanged DX)
 * - Production: writes to console AND adds Sentry breadcrumbs for all
 *   log/warn/error calls so they appear in the issue timeline.
 *   Errors are also captured as Sentry exceptions automatically.
 *
 * Usage:
 *   const log = createLogger("whatsapp", { clinic_id: "abc", phone: "...4567" });
 *   log.info("step advanced", { from: 2, to: 3 });
 *   log.warn("phone_number_id missing");
 *   log.error("saveHistory failed", err);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  debug(message: string, extra?: LogContext): void;
  info(message: string, extra?: LogContext): void;
  warn(message: string, extra?: LogContext): void;
  error(message: string, errOrExtra?: unknown, extra?: LogContext): void;
}

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Creates a logger bound to a specific module and base context.
 *
 * @param module  Short identifier shown in every log line, e.g. "whatsapp"
 * @param base    Key-value pairs attached to every log entry (e.g. clinic_id)
 */
export function createLogger(module: string, base: LogContext = {}): Logger {
  const prefix = `[${module}]`;

  function merge(extra?: LogContext): LogContext {
    return { ...base, ...extra };
  }

  function toConsoleLevel(level: LogLevel) {
    if (level === "error") return console.error;
    if (level === "warn")  return console.warn;
    return console.log;
  }

  function addSentryBreadcrumb(level: LogLevel, message: string, data: LogContext) {
    // Lazy-import so tests and edge-runtime builds don't hard-depend on Sentry
    try {
      // @sentry/nextjs is available when NEXT_PUBLIC_SENTRY_DSN is set
      const Sentry = require("@sentry/nextjs") as typeof import("@sentry/nextjs");
      Sentry.addBreadcrumb({
        category: module,
        message,
        level: level === "debug" ? "debug" : level === "info" ? "info" : level === "warn" ? "warning" : "error",
        data,
      });
    } catch {
      // Sentry not available — ignore silently
    }
  }

  function captureSentryError(err: unknown, context: LogContext) {
    try {
      const Sentry = require("@sentry/nextjs") as typeof import("@sentry/nextjs");
      Sentry.withScope((scope) => {
        scope.setExtras(context as Record<string, unknown>);
        if (err instanceof Error) {
          Sentry.captureException(err);
        } else {
          Sentry.captureMessage(String(err), "error");
        }
      });
    } catch {
      // ignore
    }
  }

  function log(level: LogLevel, message: string, extra?: LogContext) {
    const ctx = merge(extra);
    const consoleFn = toConsoleLevel(level);

    // Always log to console (Vercel captures stdout/stderr)
    if (Object.keys(ctx).length > 0) {
      consoleFn(`${prefix} ${message}`, ctx);
    } else {
      consoleFn(`${prefix} ${message}`);
    }

    // In production: also add Sentry breadcrumb for observability timeline
    if (IS_PROD) {
      addSentryBreadcrumb(level, message, ctx);
    }
  }

  return {
    debug(message, extra) {
      log("debug", message, extra);
    },

    info(message, extra) {
      log("info", message, extra);
    },

    warn(message, extra) {
      log("warn", message, extra);
    },

    error(message, errOrExtra, extra) {
      // Overload: error(msg, Error, context?) or error(msg, context?)
      let err: unknown = undefined;
      let ctx: LogContext | undefined = extra;

      if (errOrExtra instanceof Error || (errOrExtra !== null && typeof errOrExtra === "object" && !isPlainContext(errOrExtra))) {
        err = errOrExtra;
      } else {
        ctx = (errOrExtra as LogContext | undefined) ?? extra;
      }

      const fullCtx = merge(ctx);

      // Add error message/stack to context for the console line
      const errorStr = err instanceof Error ? err.message : err !== undefined ? String(err) : undefined;
      const logCtx: LogContext = errorStr ? { ...fullCtx, error: errorStr } : fullCtx;

      log("error", message, logCtx);

      // In production: capture the Error object in Sentry (with full stack trace)
      if (IS_PROD && err !== undefined) {
        captureSentryError(err, fullCtx);
      }
    },
  };
}

/** Returns true if value looks like a plain LogContext (not an Error or class instance) */
function isPlainContext(v: unknown): v is LogContext {
  return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}
