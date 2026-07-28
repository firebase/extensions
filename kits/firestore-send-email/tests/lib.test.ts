import { describe, expect, test, vi } from "vitest";

vi.mock("firebase-functions", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("firebase-functions/params", () => {
  throw new Error("./lib must not import firebase-functions/params");
});

describe("./lib", () => {
  test("imports without declaring Firebase params", async () => {
    const lib = await import("../src/lib");
    expect(lib.handleQueueDoc).toBeTypeOf("function");
    expect(lib.resolveConfig).toBeTypeOf("function");
  }, 15000);
});
