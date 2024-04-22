import * as path from "path";
import * as logs from "../src/logs";
import { supportedContentTypes } from "../src/resize-image";
import { ObjectMetadata } from "firebase-functions/v1/storage";

jest.mock("../src/config", () => {
  return {
    config: {
      location: "us-central1",
      imgBucket: "extensions-testing.appspot.com",
      cacheControlHeader: undefined,
      imgSizes: ["200x200"],
      resizedImagesPath: undefined,
      deleteOriginalFile: "true",
    },
  };
});

jest.mock("../src/logs", () => ({
  noContentType: jest.fn(),
  contentTypeInvalid: jest.fn(),
  gzipContentEncoding: jest.fn(),
  unsupportedType: jest.fn(),
  imageOutsideOfPaths: jest.fn(),
  imageInsideOfExcludedPaths: jest.fn(),
  imageAlreadyResized: jest.fn(),
  imageFailedAttempt: jest.fn(),
}));

import { shouldResize } from "../src/filters";
import { startsWithArray } from "../src/util";
import { config } from "../src/config";

jest.mock("../src/util");

const defaultMetadata = {
  name: "path/to/image.jpg",
  contentType: "image/jpeg",
  metadata: {},
};

describe("shouldResize function", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.excludePathList = undefined;
    config.includePathList = undefined;
    config.imageSizes = ["200x200"];
    config.location = "us-central1";
  });

  describe("Content Type Checks", () => {
    test.each([
      ["no contentType", undefined, logs.noContentType],
      ["non-image contentType", "text/plain", logs.contentTypeInvalid],
      ["unsupported image format", "image/foo", logs.unsupportedType],
    ])("%s", (desc, contentType, logFunction) => {
      const object = { ...defaultMetadata, contentType };
      const result = shouldResize(object as ObjectMetadata);
      expect(logFunction).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  test("gzip", () => {
    const result = shouldResize({
      ...defaultMetadata,
      contentEncoding: "gzip",
    } as ObjectMetadata);
    expect(logs.gzipContentEncoding).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  describe("Path Validations", () => {
    test("returns false if image is outside of allowed paths", () => {
      config.includePathList = ["/allowed"];
      const tmpFilePath = path.resolve("/", path.dirname(defaultMetadata.name));
      (startsWithArray as jest.Mock).mockReturnValue(false);
      const result = shouldResize(defaultMetadata as ObjectMetadata);
      const calls = (logs.imageOutsideOfPaths as jest.Mock).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0][0]).toBe(config.includePathList[0]);
      expect(result).toBe(false);
    });

    test("returns false if image is inside of excluded paths", () => {
      config.excludePathList = ["/not-allowed"];
      const tmpFilePath = path.resolve("/", "path/not-allowed/image.jpg");
      (startsWithArray as jest.Mock).mockReturnValue(true);
      const result = shouldResize({
        ...defaultMetadata,
        name: tmpFilePath,
      } as ObjectMetadata);
      const calls = (logs.imageInsideOfExcludedPaths as jest.Mock).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0][0]).toBe(config.excludePathList[0]);
      expect(result).toBe(false);
    });
  });

  describe("Metadata Checks", () => {
    test.each([
      ["already resized", { resizedImage: "true" }, logs.imageAlreadyResized],
      [
        "resizing failed previously",
        { resizeFailed: true },
        logs.imageFailedAttempt,
      ],
    ])(
      "returns false if image metadata indicates %s",
      (desc, metadata, logFn) => {
        const result = shouldResize({
          ...defaultMetadata,
          metadata,
        } as unknown as ObjectMetadata);
        expect(logFn).toHaveBeenCalled();
        expect(result).toBe(false);
      }
    );
  });

  test("returns true if all conditions are met", () => {
    config.includePathList = ["/allowed"];
    config.excludePathList = ["/not-allowed"];
    (startsWithArray as jest.Mock)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    const result = shouldResize({
      ...defaultMetadata,
      name: "path/allowed/image.jpg",
    } as ObjectMetadata);
    expect(result).toBe(true);
  });
});
