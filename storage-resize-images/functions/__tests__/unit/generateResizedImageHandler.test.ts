import * as path from "path";
import { config as loadEnv } from "dotenv";

const envLocalPath = path.resolve(
  __dirname,
  "../../../../_emulator/extensions/storage-resize-images.env.local"
);

loadEnv({ path: envLocalPath, debug: true, override: true });

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
  processContentFilter: jest.fn(),
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
import { processContentFilter } from "../../src/content-filter";
import { resizeImages } from "../../src/resize-image";

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
    (processContentFilter as jest.Mock).mockResolvedValue(false);

    await generateResizedImageHandler(mockObject, false);

    expect(resizeImages).not.toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      true
    );
  });

  test("resizes when the content filter passes", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (processContentFilter as jest.Mock).mockResolvedValue(true);
    (resizeImages as jest.Mock).mockResolvedValue([
      {
        status: "fulfilled",
        value: { success: true },
      },
    ]);

    await generateResizedImageHandler(mockObject, false);

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
    (processContentFilter as jest.Mock).mockRejectedValue(
      new Error("filter boom")
    );

    await generateResizedImageHandler(mockObject, false);

    expect(resizeImages).not.toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      parsedPathMatcher,
      false
    );
  });
});
