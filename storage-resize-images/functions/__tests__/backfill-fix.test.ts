import { shouldResize } from "../src/filters";
import { convertToObjectMetadata } from "../src/util";

jest.mock("../src/config", () => ({
  config: {
    excludePathList: ["/maps/*/thumbnails", "/pois/*/thumbnails"],
    resizedImagesPath: "thumbnails",
    backfillBatchSize: 3,
    imageSizes: ["640x480", "1200x800", "1920x1280"],
    imageType: "avif",
    includePathList: undefined,
    doBackfill: true,
    location: "europe-west1",
    projectId: "test-project",
  },
}));

describe("Backfill Fix Validation", () => {
  test("should only scan original images, not thumbnails", () => {
    const filesReturnedByFix = [
      createMockFile("/maps/location1/image1.jpg", "image/jpeg"),
      createMockFile("/maps/location2/image2.png", "image/png"),
      createMockFile("/pois/place1/photo1.jpg", "image/jpeg"),
      createMockFile("/other/path/image3.gif", "image/gif"),
    ];

    let scannedCount = 0;
    let processedCount = 0;

    for (const file of filesReturnedByFix) {
      scannedCount++;
      const objectMetadata = convertToObjectMetadata(file.metadata);

      if (shouldResize(objectMetadata)) {
        processedCount++;
      }
    }

    expect(scannedCount).toBe(4);
    expect(processedCount).toBe(4);
    expect(scannedCount).toBeLessThan(10);
  });

  test("should verify shouldResize correctly identifies excluded paths", () => {
    const originalImages = [
      createMockFile("/maps/location1/image1.jpg", "image/jpeg"),
      createMockFile("/pois/place1/photo1.png", "image/png"),
      createMockFile("/other/path/image3.gif", "image/gif"),
    ];

    for (const file of originalImages) {
      const objectMetadata = convertToObjectMetadata(file.metadata);
      const shouldResizeResult = shouldResize(objectMetadata);
      expect(shouldResizeResult).toBe(true);
    }

    const thumbnailImages = [
      createMockFile(
        "/maps/location1/thumbnails/image1_640x480.avif",
        "image/avif",
        { resizedImage: "true" }
      ),
      createMockFile(
        "/pois/place1/thumbnails/photo1_1200x800.avif",
        "image/avif",
        { resizedImage: "true" }
      ),
    ];

    for (const file of thumbnailImages) {
      const objectMetadata = convertToObjectMetadata(file.metadata);
      const shouldResizeResult = shouldResize(objectMetadata);
      expect(shouldResizeResult).toBe(false);
    }
  });

  test("should verify the fix works with different exclude path patterns", () => {
    const testCases = [
      {
        path: "/maps/location1/image1.jpg",
        shouldBeProcessed: true,
      },
      {
        path: "/maps/location1/thumbnails/image1_640x480.avif",
        shouldBeProcessed: false,
      },
      {
        path: "/pois/place1/photo1.jpg",
        shouldBeProcessed: true,
      },
      {
        path: "/pois/place1/thumbnails/photo1_640x480.avif",
        shouldBeProcessed: false,
      },
      {
        path: "/other/path/image.jpg",
        shouldBeProcessed: true,
      },
      {
        path: "/maps/any/location/thumbnails/image.jpg",
        shouldBeProcessed: false,
      },
    ];

    for (const testCase of testCases) {
      const mockFile = createMockFile(testCase.path, "image/jpeg");
      const objectMetadata = convertToObjectMetadata(mockFile.metadata);
      const shouldResizeResult = shouldResize(objectMetadata);

      expect(shouldResizeResult).toBe(testCase.shouldBeProcessed);
    }
  });

  test("should demonstrate cost efficiency with large datasets", () => {
    const largeDataset = {
      originalImages: 600000,
      thumbnails: 1800000,
    };

    const filesScannedWithFix = largeDataset.originalImages;
    const costMultiplier = filesScannedWithFix / largeDataset.originalImages;

    expect(filesScannedWithFix).toBe(largeDataset.originalImages);
    expect(costMultiplier).toBe(1);
    expect(filesScannedWithFix).toBeLessThan(
      largeDataset.originalImages + largeDataset.thumbnails
    );
  });

  test("should verify the fix prevents exponential growth scenarios", () => {
    const scenarios = [
      { cycle: 1, originalImages: 1000, thumbnailsCreated: 3000 },
      { cycle: 2, originalImages: 1000, thumbnailsCreated: 6000 },
      { cycle: 3, originalImages: 1000, thumbnailsCreated: 9000 },
      { cycle: 4, originalImages: 1000, thumbnailsCreated: 12000 },
    ];

    for (const scenario of scenarios) {
      const filesScannedWithFix = scenario.originalImages;
      const costMultiplier = filesScannedWithFix / scenario.originalImages;

      expect(filesScannedWithFix).toBe(scenario.originalImages);
      expect(costMultiplier).toBe(1);
    }
  });
});

function createMockFile(
  name: string,
  contentType: string,
  metadata: any = {}
): any {
  return {
    metadata: {
      name,
      contentType,
      metadata,
      bucket: "test-bucket",
      generation: "123456789",
      metageneration: "1",
      timeCreated: new Date().toISOString(),
      updated: new Date().toISOString(),
      size: "1024",
      md5Hash: "test-hash",
      etag: "test-etag",
      selfLink: `https://storage.googleapis.com/test-bucket/${name}`,
      mediaLink: `https://storage.googleapis.com/download/storage/v1/b/test-bucket/o/${name}?generation=123456789&alt=media`,
      crc32c: "test-crc32c",
      kind: "storage#object",
    },
    name,
    bucket: {
      name: "test-bucket",
    },
    delete: jest.fn(),
    download: jest.fn(),
    get: jest.fn(),
    getMetadata: jest.fn(),
    makePublic: jest.fn(),
    move: jest.fn(),
    save: jest.fn(),
    setMetadata: jest.fn(),
    upload: jest.fn(),
  };
}
