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

  test("goes down the failed-image path when content filter returns passed:false and failed:null", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (processContentFilter as jest.Mock).mockResolvedValue({
      passed: false,
      failed: null,
    });

    const mockObject = {
      bucket: "demo-bucket",
      name: "images/test.jpg",
      contentType: "image/jpeg",
    } as any;

    await generateResizedImageHandler(mockObject, false);

    expect(resizeImages).not.toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      expect.objectContaining({
        dir: "images",
        base: "test.jpg",
        name: "test",
        ext: ".jpg",
      }),
      true
    );
  });

  test("resizes image when content filter returns passed:true and failed:false", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (processContentFilter as jest.Mock).mockResolvedValue({
      passed: true,
      failed: false,
    });
    (resizeImages as jest.Mock).mockResolvedValue([
      {
        status: "fulfilled",
        value: { success: true },
      },
    ]);

    const mockObject = {
      bucket: "demo-bucket",
      name: "images/test.jpg",
      contentType: "image/jpeg",
    } as any;

    await generateResizedImageHandler(mockObject, false);

    expect(resizeImages).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      expect.objectContaining({
        dir: "images",
        base: "test.jpg",
        name: "test",
        ext: ".jpg",
      }),
      mockObject
    );
    expect(handleFailedImage).not.toHaveBeenCalled();
  });

  test("resizes when passed:true even if failed is null", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (processContentFilter as jest.Mock).mockResolvedValue({
      passed: true,
      failed: null,
    });
    (resizeImages as jest.Mock).mockResolvedValue([
      {
        status: "fulfilled",
        value: { success: true },
      },
    ]);

    const mockObject = {
      bucket: "demo-bucket",
      name: "images/test.jpg",
      contentType: "image/jpeg",
    } as any;

    await generateResizedImageHandler(mockObject, false);

    expect(resizeImages).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      expect.objectContaining({
        dir: "images",
        base: "test.jpg",
        name: "test",
        ext: ".jpg",
      }),
      mockObject
    );
    expect(handleFailedImage).not.toHaveBeenCalled();
  });

  test("does not resize when passed:false even if failed:false", async () => {
    (shouldResize as jest.Mock).mockReturnValue(true);
    (downloadOriginalFile as jest.Mock).mockResolvedValue([
      "/tmp/test.jpg",
      {},
    ]);
    (processContentFilter as jest.Mock).mockResolvedValue({
      passed: false,
      failed: false,
    });

    const mockObject = {
      bucket: "demo-bucket",
      name: "images/test.jpg",
      contentType: "image/jpeg",
    } as any;

    await generateResizedImageHandler(mockObject, false);

    expect(resizeImages).not.toHaveBeenCalled();
    expect(handleFailedImage).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/test.jpg",
      mockObject,
      expect.objectContaining({
        dir: "images",
        base: "test.jpg",
        name: "test",
        ext: ".jpg",
      }),
      true
    );
  });
});
