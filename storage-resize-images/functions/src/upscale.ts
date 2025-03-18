import { imagen3, imagen2, vertexAI } from "@genkit-ai/vertexai";
import { genkit } from "genkit";
import { config } from "./config";
import { ObjectMetadata } from "firebase-functions/v1/storage";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as logs from "./logs";
import {
  constructMetadata,
  getModifiedFilePath,
  ResizedImageResult,
} from "./resize-image";
import { Role } from "genkit";
/**
 * Upscales an image using Vertex AI's Imagen API
 */
export async function upscale(
  bucket: any,
  localOriginalFile: string,
  parsedPath: path.ParsedPath,
  objectMetadata: ObjectMetadata,
  upscaleFactor: string
): Promise<ResizedImageResult> {
  const contentType = objectMetadata.contentType || "";
  const allowedContentTypes = ["image/png", "image/jpeg", "image/jpg"];

  if (!allowedContentTypes.includes(contentType)) {
    logs.error(
      new Error(
        `Unsupported content type for upscaling: ${contentType}. Only PNG, JPG, and JPEG are supported.`
      )
    );
    return {
      size: upscaleFactor,
      outputFilePath: "",
      success: false,
    };
  }

  const {
    ext: fileExtension,
    dir: fileDir,
    name: fileNameWithoutExtension,
  } = parsedPath;

  // Create a unique filename for the upscaled image
  const modifiedFileName = `${fileNameWithoutExtension}_${upscaleFactor}${fileExtension}`;

  // Path where upscaled image will be uploaded to in Storage
  const modifiedFilePath = getModifiedFilePath(
    fileDir,
    config.resizedImagesPath,
    modifiedFileName
  );

  let tempUpscaledFile: string;

  try {
    // Create a temporary file for the upscaled image
    tempUpscaledFile = path.join(os.tmpdir(), `upscaled_${uuidv4()}`);

    // Read the original image file
    const imageBuffer = fs.readFileSync(localOriginalFile);

    //TODO: Log that we're starting the upscale process
    console.log("Starting upscaling process", localOriginalFile);
    // logs.imageUpscaling(localOriginalFile, upscaleFactor);

    // Convert image buffer to data URL
    const base64Image = imageBuffer.toString("base64");
    const mimeType = objectMetadata.contentType || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Use Vertex AI to upscale the image with correct API format
    const ai = genkit({
      plugins: [
        vertexAI({
          location: config.location,
          // Add any additional configuration needed for Vertex AI
          projectId: config.projectId,
        }),
      ],
    });

    console.log("initialized genkit");
    let result: any;

    try {
      result = await ai.generate({
        messages: [
          {
            role: "user",
            content: [
              {
                media: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        config: {
          mode: "upscale",
          upscaleFactor: upscaleFactor,
        },
        model: imagen3,
      });
    } catch (err) {
      console.error("Error upscaling in generate call", err);
    }

    console.log("RESULT", result);

    // Check if we have a valid response with an image
    if (!result || !Array.isArray(result) || result.length === 0) {
      console.error("Upscaling failed: No response returned from AI service");
      throw new Error("Upscaling failed: No response returned from AI service");
    }

    // Find the media response in the result array
    const mediaResponse = result.find((item) => item.media && item.media.url);

    if (!mediaResponse || !mediaResponse.media || !mediaResponse.media.url) {
      throw new Error("Upscaling failed: No image returned from AI service");
    }

    // Extract the upscaled image from the data URL
    const responseDataURL = mediaResponse.media.url;
    const base64Data = responseDataURL.split(",")[1];

    // Save the upscaled image to a temporary file
    const upscaledImageUint8Array = new Uint8Array(
      Buffer.from(base64Data, "base64")
    );

    // Write using the Uint8Array which is explicitly compatible with the expected type
    fs.writeFileSync(tempUpscaledFile, upscaledImageUint8Array);
    //TODO: Log that upscaling is complete
    // logs.imageUpscaled(localOriginalFile, upscaleFactor);

    // Prepare metadata for the upscaled image
    const metadata = constructMetadata(
      modifiedFileName,
      objectMetadata.contentType || "image/jpeg",
      objectMetadata
    );

    // Add upscale-specific metadata
    metadata.metadata.upscaledImage = true;
    metadata.metadata.upscaleFactor = upscaleFactor;
    metadata.metadata.upscaledWithAI = true;

    // Upload the upscaled image
    logs.imageUploading(modifiedFilePath);
    const uploadResponse = await bucket.upload(tempUpscaledFile, {
      destination: modifiedFilePath,
      metadata,
    });
    logs.imageUploaded(modifiedFilePath);

    // Make uploaded image public if configured
    if (config.makePublic) {
      await uploadResponse[0].makePublic();
    }

    return {
      size: upscaleFactor,
      outputFilePath: modifiedFilePath,
      success: true,
    };
  } catch (err) {
    // TODO: Log the error
    // logs.errorUpscaling(err);
    return {
      size: upscaleFactor,
      outputFilePath: modifiedFilePath,
      success: false,
    };
  } finally {
    // Clean up temporary files
    try {
      if (tempUpscaledFile && fs.existsSync(tempUpscaledFile)) {
        logs.tempResizedFileDeleting(tempUpscaledFile);
        fs.unlinkSync(tempUpscaledFile);
        logs.tempResizedFileDeleted(tempUpscaledFile);
      }
    } catch (err) {
      logs.errorDeleting(err);
    }
  }
}
