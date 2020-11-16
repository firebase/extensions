import mockedEnv from "mocked-env";
import { createCanvas } from "canvas";
import imageType from "image-type";

const env = {
  IMG_BUCKET: "IMG_BUCKET",
  CACHE_CONTROL_HEADER: "CACHE_CONTROL_HEADER",
  IMG_SIZES: "200x200",
  RESIZED_IMAGES_PATH: "RESIZED_IMAGES_PATH",
  DELETE_ORIGINAL_FILE: "DELETE_ORIGINAL_FILE",
  IMAGE_TYPE: "jpeg",
};

mockedEnv(env);

import { convertType } from "../functions/src/resize-image";
import config from "../functions/src/config";

const canvas = createCanvas(100, 50);

let bufferJPG = canvas.toBuffer("image/jpeg");
let bufferPNG = canvas.toBuffer("image/png");

describe("convertType", () => {
  it("converts to png image type", async () => {
    config.imageType = "png";
    const buffer = await convertType(bufferJPG);

    expect(imageType(buffer).mime).toBe("image/png");
  });

  it("converts to jpeg image type", async () => {
    config.imageType = "jpeg";
    const buffer = await convertType(bufferPNG);

    expect(imageType(buffer).mime).toBe("image/jpeg");
  });

  it("converts to webp image type", async () => {
    config.imageType = "webp";
    const buffer = await convertType(bufferPNG);

    expect(imageType(buffer).mime).toBe("image/webp");
  });

  it("converts to tiff image type", async () => {
    config.imageType = "tiff";
    const buffer = await convertType(bufferPNG);

    expect(imageType(buffer).mime).toBe("image/tiff");
  });

  it("remains jpeg image type when different image type is not supported", async () => {
    config.imageType = "raw";
    const buffer = await convertType(bufferJPG);

    expect(imageType(buffer).mime).toBe("image/jpeg");
  });
});
