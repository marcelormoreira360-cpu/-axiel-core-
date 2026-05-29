import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger } from "../logger";

describe("createLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("info() calls console.log with prefixed message", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test");
    log.info("hello world");
    expect(spy).toHaveBeenCalledWith("[test] hello world");
  });

  it("info() includes extra context object", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test");
    log.info("event happened", { clinic_id: "abc", step: 3 });
    expect(spy).toHaveBeenCalledWith("[test] event happened", { clinic_id: "abc", step: 3 });
  });

  it("warn() calls console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("test");
    log.warn("something odd");
    expect(spy).toHaveBeenCalledWith("[test] something odd");
  });

  it("error() calls console.error with error message in context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("test");
    const err = new Error("boom");
    log.error("operation failed", err);
    expect(spy).toHaveBeenCalledWith("[test] operation failed", { error: "boom" });
  });

  it("error() with plain context (no Error) calls console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("test");
    log.error("db error", { code: "42P01" });
    expect(spy).toHaveBeenCalledWith("[test] db error", { code: "42P01" });
  });

  it("base context is merged into every log call", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test", { clinic_id: "clinic-1" });
    log.info("step advanced", { from: 1, to: 2 });
    expect(spy).toHaveBeenCalledWith("[test] step advanced", {
      clinic_id: "clinic-1",
      from: 1,
      to: 2,
    });
  });

  it("base context is used when no extra is passed", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test", { clinic_id: "clinic-2" });
    log.info("ping");
    expect(spy).toHaveBeenCalledWith("[test] ping", { clinic_id: "clinic-2" });
  });

  it("debug() calls console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test");
    log.debug("trace point");
    expect(spy).toHaveBeenCalledWith("[test] trace point");
  });
});
