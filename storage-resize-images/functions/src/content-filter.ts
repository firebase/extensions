import vertexAI, { gemini20Flash001 } from "@genkit-ai/vertexai";
import { HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
import { genkit, z } from "genkit";
import * as fs from "fs";
import { logger as funcsLogger } from "firebase-functions";

funcsLogger.warn();

/**
 * Creates a data URL from an image file
 * @param filePath Path to the image file
 * @returns Data URL string
 */
function createImageDataUrl(filePath: string): string {
  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = getMimeType(filePath);
  return `data:${mimeType};base64,${base64Image}`;
}

/**
 * Determines MIME type based on file extension
 * @param filePath Path to the file
 * @returns MIME type string
 */
function getMimeType(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase() || "jpeg";
  return extension === "png" ? "image/png" : "image/jpeg";
}

/**
 * Creates safety settings based on filter level
 * @param filterLevel The content filter level to apply
 * @returns Array of safety settings
 */
function createSafetySettings(filterLevel: HarmBlockThreshold) {
  const categories: HarmCategory[] = [
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    HarmCategory.HARM_CATEGORY_UNSPECIFIED,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_HARASSMENT,
  ];

  return categories.map((category) => ({
    category,
    threshold: filterLevel,
  }));
}

// OFF - no filter applied
// BLOCK_NONE - no blocking
// BLOCK_ONLY_HIGH - only block high severity content
// BLOCK_MEDIUM_AND_ABOVE - block medium and high severity content
// BLOCK_LOW_AND_ABOVE - block low, medium, and high severity content
// CUSTOM - user provides a prompt (we still enforce the response via structured output) e.g "Does this image contain a cat?"

// if it's filtered, replace the image with some kind of placeholder image

/**
 * Checks if an image content is appropriate based on the provided filter level and optional custom prompt
 * @param localOriginalFile Path to the local image file
 * @param filterLevel The content filter level to apply ('LOW', 'MEDIUM', 'HIGH', or 'OFF')
 * @param prompt Optional custom prompt to use for content checking
 * @returns Promise<boolean> - true if the image passes the filter, false otherwise
 */
export async function checkImageContent(
  localOriginalFile: string,
  filterLevel: HarmBlockThreshold | "OFF",
  prompt: string | null
): Promise<boolean> {
  // If filter level is OFF and no custom prompt, skip content checking entirely
  if (filterLevel === "OFF" && prompt === null) {
    return true;
  }

  try {
    const dataUrl = createImageDataUrl(localOriginalFile);
    const mimeType = getMimeType(localOriginalFile);

    // Initialize Vertex AI client
    const ai = genkit({
      plugins: [vertexAI()],
    });

    try {
      // Determine the effective safety settings and prompt to use
      const effectiveFilterLevel =
        filterLevel === "OFF" ? HarmBlockThreshold.BLOCK_NONE : filterLevel;
      const effectivePrompt =
        prompt !== null
          ? prompt +
            '\n\n Please respond in json with either { "response": "yes" } or  { "response": "no" }'
          : "Is this image appropriate?";

      const effectiveOutput =
        prompt !== null
          ? {
              format: "json",
              schema: z.object({
                response: z.string(),
              }),
            }
          : undefined;

      // Determine max tokens based on whether we're using custom prompt
      const maxOutputTokens = prompt !== null ? 100 : 1;

      const result = await ai.generate({
        model: gemini20Flash001,
        messages: [
          {
            role: "user",
            content: [
              {
                text: effectivePrompt,
              },
              {
                media: {
                  url: dataUrl,
                  contentType: mimeType,
                },
              },
            ],
          },
        ],
        output: effectiveOutput,
        config: {
          temperature: 0.1,
          maxOutputTokens,
          safetySettings: createSafetySettings(effectiveFilterLevel),
        },
      });

      if (result.output?.response === "no" && prompt !== null) {
        console.warn("Image content blocked by Custom AI Content filter.");
        return false;
      }

      return true;
    } catch (error) {
      if (error.detail?.response?.finishReason === "blocked") {
        console.warn("Image content blocked by Vertex AI content filters.");
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error("Error checking image content with Vertex AI:", error);
    return false;
  }
}
