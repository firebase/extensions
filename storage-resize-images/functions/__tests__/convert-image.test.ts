import mockedEnv from "mocked-env";
import imageType from "image-type";
import * as util from "util";
import * as fs from "fs";
import * as path from "path";
const env = {
  IMG_BUCKET: "IMG_BUCKET",
  CACHE_CONTROL_HEADER: "CACHE_CONTROL_HEADER",
  IMG_SIZES: "200x200",
  RESIZED_IMAGES_PATH: "RESIZED_IMAGES_PATH",
  DELETE_ORIGINAL_FILE: "DELETE_ORIGINAL_FILE",
  IMAGE_TYPE: "jpeg",
};

mockedEnv(env);

import { convertType } from "../src/resize-image";
import { config } from "../src/config";

jest.mock("../src/config");

const readFile = util.promisify(fs.readFile);

let bufferJPG;
let bufferPNG;
let bufferGIF;
beforeAll(async () => {
  bufferJPG = await readFile(path.join(__dirname, "/test-image.jpeg"));
  bufferPNG = await readFile(path.join(__dirname, "/test-image.png"));
  bufferGIF = await readFile(path.join(__dirname, "/test-image.gif"));
});

describe("convertType", () => {
  it("converts to png image type", async () => {
    const buffer = await convertType(bufferJPG, "png");

    expect(imageType(buffer).mime).toBe("image/png");
  });

  it("converts to jpeg image type", async () => {
    const buffer = await convertType(bufferPNG, "jpeg");

    expect(imageType(buffer).mime).toBe("image/jpeg");
  });

  it("converts to webp image type", async () => {
    const buffer = await convertType(bufferPNG, "webp");

    expect(imageType(buffer).mime).toBe("image/webp");
  });

  it("converts to tiff image type", async () => {
    const buffer = await convertType(bufferPNG, "tiff");

    expect(imageType(buffer).mime).toBe("image/tiff");
  });

  it("converts to gif image type", async () => {
    const buffer = await convertType(bufferGIF, "gif");

    expect(imageType(buffer).mime).toBe("image/gif");
  });

  it("remains jpeg image type when different image type is not supported", async () => {
    const buffer = await convertType(bufferJPG, "raw");

    expect(imageType(buffer).mime).toBe("image/jpeg");
  });

  it("remains gif image type when different image type is not supported", async () => {
    const buffer = await convertType(bufferGIF, "raw");

    expect(imageType(buffer).mime).toBe("image/gif");
  });
});
