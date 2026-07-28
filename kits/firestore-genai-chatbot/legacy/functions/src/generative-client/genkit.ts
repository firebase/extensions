import {
  vertexAI,
  googleAI,
  GoogleAIPluginOptions,
} from "@genkit-ai/google-genai";
import { VertexPluginOptions } from "@genkit-ai/google-genai/lib/vertexai";
import { GenkitPluginV2 } from "genkit/plugin";
import type { Config } from "../config";
import {
  genkit,
  MessageData as ApiMessage,
  type GenerateOptions,
  type Genkit,
  type ModelReference,
} from "genkit";
import { ChatResponse, DiscussionClient, Message } from "./base_class";
import { logger } from "../logger";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";
import { logger as genkitLogger } from "genkit/logging";

genkitLogger.setLogLevel("info");

export class GenkitDiscussionClient extends DiscussionClient<
  Genkit,
  any,
  ApiMessage
> {
  private provider: "google-ai" | "vertex-ai";
  private generateOptions: GenerateOptions;
  client: Genkit;
  private pluginOptions: VertexPluginOptions | GoogleAIPluginOptions;
  private plugin: GenkitPluginV2;

  constructor(config: Config) {
    super();
    this.provider = config.provider;
    this.pluginOptions = this.getPluginOptions(config);
    this.plugin = this.initializePlugin();
    this.client = this.initializeGenkit(config);
    this.generateOptions = this.createGenerateOptions(config);
  }

  private getPluginOptions(config: Config) {
    if (this.provider === "google-ai") {
      if (!config.googleAi.apiKey) {
        throw new Error("API key required.");
      }
      const pluginConfig: GoogleAIPluginOptions = {
        apiKey: config.googleAi.apiKey,
      };
      return pluginConfig;
    }
    const pluginConfig: VertexPluginOptions = {
      location: config.vertex.modelLocation,
    };
    return pluginConfig;
  }

  private initializePlugin(): GenkitPluginV2 {
    if (this.provider === "google-ai") {
      return googleAI(this.pluginOptions as GoogleAIPluginOptions);
    }
    if (this.provider === "vertex-ai") {
      return vertexAI(this.pluginOptions as VertexPluginOptions);
    }
    throw new Error("Invalid provider.");
  }

  private initializeGenkit(config: Config): Genkit {
    const genkitConfig = {
      plugins: [this.plugin],
    };

    if (config.enableGenkitMonitoring) {
      try {
        enableFirebaseTelemetry();
        logger.info("Genkit Monitoring enabled");
      } catch (error) {
        logger.error("Failed to enable Genkit Monitoring", error);
      }
    }

    return genkit(genkitConfig);
  }

  static createModelReference(
    model: string,
    provider: string
  ): ModelReference<any> {
    const modelReferences =
      provider === "google-ai"
        ? [
            googleAI.model("gemini-1.5-flash"),
            googleAI.model("gemini-1.5-pro"),
            googleAI.model("gemini-2.0-flash"),
            googleAI.model("gemini-2.0-flash-lite"),
            googleAI.model("gemini-2.5-flash-lite"),
            googleAI.model("gemini-2.5-flash"),
            googleAI.model("gemini-2.5-pro"),
            googleAI.model("gemini-3-pro-preview"),
            googleAI.model("gemini-3-pro-image-preview"),
          ]
        : [
            vertexAI.model("gemini-1.5-flash"),
            vertexAI.model("gemini-1.5-pro"),
            vertexAI.model("gemini-2.0-flash"),
            vertexAI.model("gemini-2.0-flash-lite"),
            vertexAI.model("gemini-2.0-flash-001"),
            vertexAI.model("gemini-2.5-flash-lite"),
            vertexAI.model("gemini-2.5-flash"),
            vertexAI.model("gemini-2.5-pro"),
            vertexAI.model("gemini-3-pro-preview"),
            vertexAI.model("gemini-3-pro-image-preview"),
          ];

    const pluginName = provider === "google-ai" ? "googleai" : "vertexai";

    for (const modelReference of modelReferences) {
      if (modelReference.name === `${pluginName}/${model}`) {
        return modelReference;
      }
      if (modelReference.info?.versions?.includes(model)) {
        return modelReference.withVersion(model);
      }
    }
    throw new Error("Model not found.");
  }

  private createGenerateOptions(config: Config): GenerateOptions {
    if (!config.model) {
      throw new Error("Model not found.");
    }

    return {
      model: GenkitDiscussionClient.createModelReference(
        config.model,
        config.provider
      ),
      config: {
        topP: config.topP,
        topK: config.topK,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        safetySettings: config.safetySettings,
      },
    };
  }

  //   We use this to check before creating the client to see if we should use the Genkit client
  static shouldUseGenkitClient(config: Config): boolean {
    const shouldReturnMultipleCandidates =
      config.candidateCount && config.candidateCount > 1;
    return (
      !shouldReturnMultipleCandidates &&
      !!GenkitDiscussionClient.createModelReference(
        config.model,
        config.provider
      )
    );
  }

  async generateResponse(
    history: Message[],
    latestApiMessage: any,
    _options: any
  ): Promise<ChatResponse> {
    logger.debug("Generating response with Genkit");

    const messages = this.messagesToApi(history);

    const llmResponse = await this.client.generate({
      messages,
      prompt: latestApiMessage.content[0].text,
      ...this.generateOptions,
    });

    return {
      response: llmResponse.text,
      candidates: [llmResponse.text],
      history,
    };
  }

  createApiMessage(
    messageContent: string,
    role: "user" | "model" = "user"
  ): ApiMessage {
    const apiRole = role === "user" ? "user" : "model";

    return {
      role: apiRole,
      content: [{ text: messageContent }],
    };
  }

  messagesToApi(messages: Message[]): ApiMessage[] {
    const out: ApiMessage[] = [];
    for (const message of messages) {
      if (!message.prompt || !message.response) {
        continue;
      }
      out.push({ role: "user", content: [{ text: message.prompt }] });
      out.push({ role: "model", content: [{ text: message.response }] });
    }
    return out;
  }
}
