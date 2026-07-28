import { normalize } from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

import { resolveConfig } from "../src/export-config";
import { type HandlerContext, handleObjectFinalized } from "../src/handlers";
import { Status } from "../src/types";

// Stub the filesystem helpers the handler uses so it never touches disk.
vi.mock("node:os", () => ({ tmpdir: () => "/tmp" }));
vi.mock("mkdirp", () => ({ mkdirp: vi.fn().mockResolvedValue(undefined) }));
const { unlinkMock } = vi.hoisted(() => ({
  unlinkMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("node:fs/promises", () => ({ unlink: unlinkMock }));

/** Builds a fake StorageEvent carrying the given object metadata. */
function storageEvent(object: Record<string, unknown>) {
  return { data: object } as unknown as Parameters<
    typeof handleObjectFinalized
  >[0];
}

/** Builds a HandlerContext with everything mocked. */
function makeCtx(
  overrides: {
    config?: Record<string, unknown>;
    transcodeResult?: unknown;
    uploadResult?: unknown;
    transcribeResult?: unknown;
  } = {}
): HandlerContext {
  const remoteFile = { download: vi.fn().mockResolvedValue(undefined) };
  const bucket = { file: vi.fn(() => remoteFile) };

  const docRef = { id: "doc-1" };
  const collection = {
    add: vi.fn().mockResolvedValue(docRef),
    doc: vi.fn(() => ({ set: vi.fn().mockResolvedValue(undefined) })),
  };
  const db = { collection: vi.fn(() => collection) };

  const fns = {
    transcodeToLinear16: vi.fn().mockResolvedValue(
      overrides.transcodeResult ?? {
        status: Status.SUCCESS,
        outputPath: "/local.wav",
        sampleRateHertz: 16000,
        audioChannelCount: 1,
        warnings: [],
      }
    ),
    uploadTranscodedFile: vi.fn().mockResolvedValue(
      overrides.uploadResult ?? {
        status: Status.SUCCESS,
        uploadResponse: [{ bucket: { name: "b" }, name: "out.wav" }, {}],
      }
    ),
    transcribeAndUpload: vi.fn().mockResolvedValue(
      overrides.transcribeResult ?? {
        status: Status.SUCCESS,
        warnings: [],
        transcription: { 1: ["hello world"] },
      }
    ),
  };

  const eventsMock = {
    setupEventChannel: vi.fn(),
    recordCompleteEvent: vi.fn().mockResolvedValue(undefined),
    recordFailureEvent: vi.fn().mockResolvedValue(undefined),
    recordErrorEvent: vi.fn().mockResolvedValue(undefined),
  };

  return {
    config: resolveConfig({
      bucket: "demo.appspot.com",
      languageCode: "en-US",
      collectionPath: "transcriptions",
      ...overrides.config,
    }),
    db: db as unknown as HandlerContext["db"],
    client: {} as HandlerContext["client"],
    getBucket: vi.fn(() => bucket) as unknown as HandlerContext["getBucket"],
    fns: fns as unknown as HandlerContext["fns"],
    events: eventsMock as unknown as HandlerContext["events"],
  };
}

const audioObject = {
  name: "test.wav",
  bucket: "demo.appspot.com",
  contentType: "audio/wav",
};

describe("handleObjectFinalized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("transcribes audio and emits a complete event on success", async () => {
    const ctx = makeCtx();

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(ctx.fns.transcodeToLinear16).toHaveBeenCalledTimes(1);
    expect(ctx.fns.uploadTranscodedFile).toHaveBeenCalledTimes(1);
    expect(ctx.fns.transcribeAndUpload).toHaveBeenCalledTimes(1);
    expect(ctx.events.recordCompleteEvent).toHaveBeenCalledTimes(1);
    expect(ctx.events.recordCompleteEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: Status.SUCCESS }),
      "test.wav"
    );
    expect(ctx.events.recordFailureEvent).not.toHaveBeenCalled();
  });

  test("passes resolved speech options through to the recognizer", async () => {
    const ctx = makeCtx({
      config: { model: "video", enableAutomaticPunctuation: false },
    });

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(ctx.fns.transcribeAndUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          languageCode: "en-US",
          model: "video",
          enableAutomaticPunctuation: false,
        },
      })
    );
  });

  test("emits a fail event when transcription fails", async () => {
    const ctx = makeCtx({
      transcribeResult: { status: Status.FAILURE, warnings: [], type: 5 },
    });

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(ctx.events.recordFailureEvent).toHaveBeenCalledTimes(1);
    expect(ctx.events.recordFailureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: Status.FAILURE }),
      "test.wav"
    );
    expect(ctx.events.recordCompleteEvent).not.toHaveBeenCalled();
  });

  test("emits a fail event when transcoding fails", async () => {
    const ctx = makeCtx({
      transcodeResult: { status: Status.FAILURE, warnings: [], type: 1 },
    });

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(ctx.fns.uploadTranscodedFile).not.toHaveBeenCalled();
    expect(ctx.fns.transcribeAndUpload).not.toHaveBeenCalled();
    expect(ctx.events.recordFailureEvent).toHaveBeenCalledTimes(1);
  });

  test("emits a fail event when the transcoded upload fails", async () => {
    const ctx = makeCtx({
      uploadResult: { status: Status.FAILURE, warnings: [], type: 7 },
    });

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(ctx.fns.transcribeAndUpload).not.toHaveBeenCalled();
    expect(ctx.events.recordFailureEvent).toHaveBeenCalledTimes(1);
  });

  test("emits an error fail event when the pipeline throws", async () => {
    const ctx = makeCtx();
    (ctx.fns.transcodeToLinear16 as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom")
    );

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(ctx.events.recordErrorEvent).toHaveBeenCalledTimes(1);
    expect(ctx.events.recordErrorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ message: "boom" })
    );
  });

  test("ignores objects with no name", async () => {
    const ctx = makeCtx();

    await handleObjectFinalized(
      storageEvent({ bucket: "demo.appspot.com", contentType: "audio/wav" }),
      ctx
    );

    expect(ctx.db.collection).not.toHaveBeenCalled();
    expect(ctx.fns.transcodeToLinear16).not.toHaveBeenCalled();
  });

  test("ignores objects this extension produced", async () => {
    const ctx = makeCtx();

    await handleObjectFinalized(
      storageEvent({ ...audioObject, metadata: { isTranscodeOutput: "true" } }),
      ctx
    );

    expect(ctx.db.collection).not.toHaveBeenCalled();
    expect(ctx.fns.transcodeToLinear16).not.toHaveBeenCalled();
  });

  test("marks the doc FAILED and stops when content type is missing", async () => {
    const ctx = makeCtx();
    const setSpy = vi.fn().mockResolvedValue(undefined);
    (ctx.db.collection as ReturnType<typeof vi.fn>).mockReturnValue({
      add: vi.fn().mockResolvedValue({ id: "doc-1" }),
      doc: vi.fn(() => ({ set: setSpy })),
    });

    await handleObjectFinalized(
      storageEvent({ name: "x.wav", bucket: "demo.appspot.com" }),
      ctx
    );

    expect(setSpy).toHaveBeenCalledWith(
      { status: "FAILED", message: "No content type provided." },
      { merge: true }
    );
    expect(ctx.fns.transcodeToLinear16).not.toHaveBeenCalled();
  });

  test("marks the doc FAILED and stops for non-audio content", async () => {
    const ctx = makeCtx();
    const setSpy = vi.fn().mockResolvedValue(undefined);
    (ctx.db.collection as ReturnType<typeof vi.fn>).mockReturnValue({
      add: vi.fn().mockResolvedValue({ id: "doc-1" }),
      doc: vi.fn(() => ({ set: setSpy })),
    });

    await handleObjectFinalized(
      storageEvent({
        name: "x.txt",
        bucket: "demo.appspot.com",
        contentType: "text/plain",
      }),
      ctx
    );

    expect(setSpy).toHaveBeenCalledWith(
      { status: "FAILED", message: "Invalid content type." },
      { merge: true }
    );
    expect(ctx.fns.transcodeToLinear16).not.toHaveBeenCalled();
  });

  test("skips Firestore writes when no collectionPath is configured", async () => {
    const ctx = makeCtx({ config: { collectionPath: undefined } });

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(ctx.db.collection).not.toHaveBeenCalled();
    expect(ctx.events.recordCompleteEvent).toHaveBeenCalledTimes(1);
  });

  test("uploads the transcoded file to a bucket-relative path, not the /tmp path", async () => {
    const ctx = makeCtx();

    await handleObjectFinalized(
      storageEvent({ ...audioObject, name: "nested/clip.mp3" }),
      ctx
    );

    expect(ctx.fns.uploadTranscodedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        localPath: normalize("/tmp/nested/clip.mp3.wav"),
        storagePath: "nested/clip.mp3.wav",
      })
    );
  });

  test("prefixes the transcoded object with outputStoragePath without leaking /tmp", async () => {
    const ctx = makeCtx({ config: { outputStoragePath: "transcoded/" } });

    await handleObjectFinalized(
      storageEvent({ ...audioObject, name: "clip.mp3" }),
      ctx
    );

    expect(ctx.fns.uploadTranscodedFile).toHaveBeenCalledWith(
      expect.objectContaining({ storagePath: "transcoded/clip.mp3.wav" })
    );
  });

  test("cleans up both temp files after a successful run", async () => {
    const ctx = makeCtx();

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(unlinkMock).toHaveBeenCalledWith(normalize("/tmp/test.wav"));
    expect(unlinkMock).toHaveBeenCalledWith(normalize("/tmp/test.wav.wav"));
  });

  test("cleans up temp files even when the pipeline throws", async () => {
    const ctx = makeCtx();
    (ctx.fns.transcodeToLinear16 as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom")
    );

    await handleObjectFinalized(storageEvent(audioObject), ctx);

    expect(unlinkMock).toHaveBeenCalledWith(normalize("/tmp/test.wav"));
    expect(unlinkMock).toHaveBeenCalledWith(normalize("/tmp/test.wav.wav"));
  });

  test("tolerates temp files that were never created during cleanup", async () => {
    const ctx = makeCtx();
    unlinkMock.mockRejectedValueOnce(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );

    await expect(
      handleObjectFinalized(storageEvent(audioObject), ctx)
    ).resolves.toBeUndefined();
  });
});
