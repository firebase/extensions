import { beforeEach, describe, expect, test, vi } from "vitest";

const { probePromise } = vi.hoisted(() => ({ probePromise: vi.fn() }));

vi.mock("../src/util", async () => {
  const actual = await vi.importActual<typeof import("../src/util")>(
    "../src/util"
  );
  return { ...actual, probePromise };
});

// Make the ffmpeg transcode chain resolve immediately so transcodeToLinear16
// reaches its SUCCESS return without touching the filesystem. `ffprobe` is
// stubbed so util's `promisify(ffmpeg.ffprobe)` still gets a function.
vi.mock("fluent-ffmpeg", () => {
  const chain = {
    save: vi.fn(() => chain),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === "end") {
        // Defer so both .on() calls are registered before firing.
        queueMicrotask(() => cb("", ""));
      }
      return chain;
    }),
  };
  const ffmpeg = vi.fn(() => chain) as unknown as {
    (...args: unknown[]): typeof chain;
    ffprobe: () => void;
  };
  ffmpeg.ffprobe = vi.fn();
  return { default: ffmpeg };
});

import { transcodeToLinear16 } from "../src/transcribe";
import { Status } from "../src/types";

describe("transcodeToLinear16", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("coerces the ffprobe string sample_rate into a number", async () => {
    // ffprobe reports sample_rate as a string, e.g. "44100".
    probePromise.mockResolvedValue({
      streams: [{ sample_rate: "44100", channels: 2 }],
    });

    const result = await transcodeToLinear16("/tmp/audio.mp3");

    expect(result.status).toBe(Status.SUCCESS);
    if (result.status === Status.SUCCESS) {
      expect(result.sampleRateHertz).toBe(44100);
      expect(typeof result.sampleRateHertz).toBe("number");
    }
  });
});
