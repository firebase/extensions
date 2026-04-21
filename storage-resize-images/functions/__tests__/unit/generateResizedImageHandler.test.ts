import * as path from "path";
import * as fs from "fs";
import { config as loadEnv } from "dotenv";

const envLocalPath = path.resolve(
  __dirname,
  "../../../../_emulator/extensions/storage-resize-images.env.local"
);

loadEnv({ path: envLocalPath, debug: true, override: true });

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  copyFileSync: jest.fn(),
}));

jest.mock("../../src/filters", () => ({
  shouldResize: jest.fn(),
}));

jest.mock("../../src/file-operations", () => ({
  downloadOriginalFile: jest.fn(),
  handleFailedImage: jest.fn(),
  deleteTempFile: jest.fn().mockResolvedValue(undefined),
  deleteRemoteFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/content-filter", () => ({
  checkImageContent: jest.fn(),
}));

jest.mock("../../src/placeholder", () => ({
  replacePlaceholder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/resize-image", () => ({
  resizeImages: jest.fn(),
}));

jest.mock("../../src/events", () => ({
  setupEventChannel: jest.fn(),
  recordStartResizeEvent: jest.fn().mockResolvedValue(undefined),
  recordSuccessEvent: jest.fn().mockResolvedValue(undefined),
  recordErrorEvent: jest.fn().mockResolvedValue(undefined),
  recordStartEvent: jest.fn().mockResolvedValue(undefined),
  recordCompletionEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/logs", () => ({
  init: jest.fn(),
  start: jest.fn(),
  failed: jest.fn(),
  complete: jest.fn(),
  error: jest.fn(),
  contentFilterErrored: jest.fn(),
  contentFilterRejected: jest.fn(),
  placeholderReplaceError: jest.fn(),
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  storage: jest.fn(() => ({
    bucket: jest.fn(() => ({})),
  })),
}));

import { generateResizedImageHandler } from "../../src/index";
import { shouldResize } from "../../src/filters";
import {
  downloadOriginalFile,
  handleFailedImage,
} from "../../src/file-operations";
import { checkImageContent } from "../../src/content-filter";
import { replacePlaceholder } from "../../src/placeholder";
import { resizeImages } from "../../src/resize-image";
import * as logs from "../../src/logs";
import exp from "constants";

describe("generateResizedImageHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockObject = {
    bucket: "demo-bucket",
    name: "images/test.jpg",
    contentType: "image/jpeg",
  } as any;

  const parsedPathMatcher = expect.objectContaining({
    dir: "images",
    base: "test.jpg",
    name: "test",
    ext: ".jpg",
  });

  test("routes blocked-by-filter images to the failed-image path with blockedByFilter=true", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (checkImageContent as jest.Mock).mockResolvedValue(false);
    (resizeImages as jest.Mock).mockResolvedValue([
      {
        status: "fulfilled",
        value: { success: true },
      },
    ]);

    await generateResizedImageHandler(mockObject, false);

    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      true
    );
    expect(handleFailedImage).toHaveBeenCalledTimes(1);
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      "/tmp/test.jpg",
      "/tmp/test.jpg-placeholder"
    );
    expect(replacePlaceholder).toHaveBeenCalledWith(
      "/tmp/test.jpg-placeholder",
      {},
      null
    );
    expect(resizeImages).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg-placeholder",
      parsedPathMatcher,
      mockObject
    );
  });

  test("resizes when the content filter passes", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (checkImageContent as jest.Mock).mockResolvedValue(true);
    (resizeImages as jest.Mock).mockResolvedValue([
      {
        status: "fulfilled",
        value: { success: true },
      },
    ]);

    await generateResizedImageHandler(mockObject, false);

    expect(replacePlaceholder).not.toHaveBeenCalled();
    expect(resizeImages).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      parsedPathMatcher,
      mockObject
    );
    expect(handleFailedImage).not.toHaveBeenCalled();
  });

  test("treats filter errors as failures and skips resizing", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (checkImageContent as jest.Mock).mockRejectedValue(
      new Error("filter boom")
    );

    await generateResizedImageHandler(mockObject, false);

    expect(replacePlaceholder).not.toHaveBeenCalled();
    expect(resizeImages).not.toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      false
    );
  });

  test("still routes blocked images to the failed path when placeholder swap errors", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (checkImageContent as jest.Mock).mockResolvedValue(false);

    const swapErr = new Error("swap boom");
    (replacePlaceholder as jest.Mock).mockRejectedValue(swapErr);

    await generateResizedImageHandler(mockObject, false);

    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      true
    );
    expect(handleFailedImage).toHaveBeenCalledTimes(1);
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      "/tmp/test.jpg",
      "/tmp/test.jpg-placeholder"
    );
    expect(replacePlaceholder).toHaveBeenCalledWith(
      "/tmp/test.jpg-placeholder",
      {},
      null
    );
    expect(logs.placeholderReplaceError).toHaveBeenCalledWith(swapErr);
    expect(logs.contentFilterErrored).not.toHaveBeenCalled();
    expect(resizeImages).not.toHaveBeenCalled();
  });
});
