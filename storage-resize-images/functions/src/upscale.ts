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
      // result = await ai.generate({
      //   messages: [
      //     {
      //       role: "user",
      //       content: [
      //         {
      //           media: {
      //             url: dataUrl,
      //           },
      //         },
      //       ],
      //     },
      //   ],
      //   config: {
      //     mode: "upscale",
      //     upscaleFactor: upscaleFactor,
      //   },
      //   model: imagen3,
      // });

      result = await upscaleImage(
        config.projectId,
        "us-central1",
        base64Image,
        "",
        upscaleFactor === "x2" ? 2 : 4
      );
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

const { GoogleAuth } = require("google-auth-library");

/**
 * Upscales an image using Google's Imagen API
 * @param {string} projectId - Google Cloud project ID
 * @param {string} location - API location (e.g., 'us-central1')
 * @param {string} base64Image - Base64 encoded image
 * @param {string} prompt - Optional prompt to guide upscaling
 * @param {number} factor - Upscale factor (default: 2)
 * @returns {Promise<Object>} - The API response
 */
async function upscaleImage(
  projectId,
  location,
  base64Image,
  prompt = "",
  factor = 2
) {
  // Create a new GoogleAuth instance for authentication
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  // Get the access token
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  // API endpoint
  const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;
  console.log("API URL", apiUrl);
  // Request payload
  const requestBody = {
    instances: [
      {
        prompt: prompt,
        image: {
          bytesBase64Encoded: base64Image,
        },
      },
    ],
    parameters: {
      sampleCount: 1,
      mode: "upscale",
      upscaleConfig: {
        upscaleFactor: `x${factor}`,
      },
    },
  };

  try {
    // Make the API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken.token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling Imagen API:", error);
    throw error;
  }
}
