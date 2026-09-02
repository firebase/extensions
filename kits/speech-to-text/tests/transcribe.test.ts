/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

import { transcodeToLinear16, transcribeAndUpload } from "../src/transcribe";
import { Status } from "../src/types";
import type { SpeechClient } from "@google-cloud/speech";
import type { Bucket } from "@google-cloud/storage";

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

describe("transcribeAndUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("writes the .txt next to the uploaded object, even when its path contains tmp/", async () => {
    const longRunningRecognize = vi.fn().mockResolvedValue([
      {
        promise: vi.fn().mockResolvedValue([
          {
            results: [
              { channelTag: 1, alternatives: [{ transcript: "hello" }] },
            ],
          },
        ]),
      },
    ]);
    const client = { longRunningRecognize } as unknown as SpeechClient;

    const result = await transcribeAndUpload({
      client,
      file: {
        bucket: { name: "my-bucket" } as Bucket,
        name: "audio/tmp/clip.mp3.wav",
      },
      sampleRateHertz: 44100,
      audioChannelCount: 1,
      options: {
        languageCode: "en-US",
        model: "default",
        enableAutomaticPunctuation: true,
      },
    });

    expect(result.status).toBe(Status.SUCCESS);
    expect(longRunningRecognize).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: { uri: "gs://my-bucket/audio/tmp/clip.mp3.wav" },
        outputConfig: {
          gcsUri: "gs://my-bucket/audio/tmp/clip.mp3.wav_transcription.txt",
        },
      })
    );
  });
});
