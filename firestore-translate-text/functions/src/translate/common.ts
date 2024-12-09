import { v2 } from "@google-cloud/translate";
import * as logs from "../logs";
import * as events from "../events";
import * as admin from "firebase-admin";
import config from "../config";
import { genkit, Genkit, z, ModelReference } from "genkit";
import vertexAI, {
  gemini15Pro as gemini15ProVertex,
} from "@genkit-ai/vertexai";
import {
  gemini15Pro as gemini15ProGoogleAI,
  googleAI,
} from "@genkit-ai/googleai";

export type Translation = {
  language: string;
  output: string;
};

interface ITranslator {
  translate(text: string, targetLanguage: string): Promise<string>;
}
export class GoogleTranslator implements ITranslator {
  private client: v2.Translate;

  constructor(projectId: string) {
    this.client = new v2.Translate({ projectId });
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    try {
      const [translatedString] = await this.client.translate(
        text,
        targetLanguage
      );
      logs.translateStringComplete(text, targetLanguage, translatedString);
      return translatedString;
    } catch (err) {
      logs.translateStringError(text, targetLanguage, err);
      await events.recordErrorEvent(err as Error);
      throw err;
    }
  }
}

export class GenkitTranslator implements ITranslator {
  private client: Genkit;
  plugin: "vertexai" | "googleai";
  model: ModelReference<any>;

  constructor({ plugin }: { plugin: "vertexai" | "googleai" }) {
    this.plugin = plugin;
    if (plugin === "googleai" && !config.googleAIAPIKey) {
      throw new Error(
        "Google AI API key is required for Genkit Google AI translations"
      );
    }

    this.model =
      plugin === "vertexai" ? gemini15ProVertex : gemini15ProGoogleAI;

    const plugins =
      plugin === "vertexai"
        ? [vertexAI({ location: process.env.LOCATION! })]
        : [googleAI({ apiKey: config.googleAIAPIKey })];

    this.client = genkit({
      plugins,
    });
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    try {
      const prompt =
        "Translate the following text to " + targetLanguage + ":\n" + text;

      const response = await this.client.generate({
        model: this.model,
        output: {
          format: "json",
          schema: z.object({
            translation: z.string(),
          }),
        },
        prompt: prompt,
      });

      if (!response.output) {
        throw new Error("No translation returned from Gemini15Pro model");
      }

      logs.translateStringComplete(text, targetLanguage, response.text);
      return response.output.translation;
    } catch (err) {
      logs.translateStringError(text, targetLanguage, err);
      await events.recordErrorEvent(err as Error);
      throw err;
    }
  }
}

export class TranslationService {
  constructor(private translator: ITranslator) {}

  async translateString(text: string, targetLanguage: string): Promise<string> {
    return this.translator.translate(text, targetLanguage);
  }

  extractInput(snapshot: admin.firestore.DocumentSnapshot): any {
    return snapshot.get(config.inputFieldName);
  }

  extractOutput(snapshot: admin.firestore.DocumentSnapshot): any {
    return snapshot.get(config.outputFieldName);
  }

  extractLanguages(snapshot: admin.firestore.DocumentSnapshot): string[] {
    if (!config.languagesFieldName) return config.languages;
    return snapshot.get(config.languagesFieldName) || config.languages;
  }

  filterLanguagesFn(
    existingTranslations: Record<string, any>
  ): (targetLanguage: string) => boolean {
    return (targetLanguage: string) => {
      if (existingTranslations[targetLanguage] != undefined) {
        logs.skippingLanguage(targetLanguage);
        return false;
      }
      return true;
    };
  }

  async updateTranslations(
    snapshot: admin.firestore.DocumentSnapshot,
    translations: any
  ): Promise<void> {
    logs.updateDocument(snapshot.ref.path);

    await admin.firestore().runTransaction((transaction) => {
      transaction.update(snapshot.ref, config.outputFieldName, translations);
      return Promise.resolve();
    });

    logs.updateDocumentComplete(snapshot.ref.path);
    await events.recordSuccessEvent({
      subject: snapshot.ref.path,
      data: { outputFieldName: config.outputFieldName, translations },
    });
  }
}

const translationService = config.useGenkit
  ? new TranslationService(new GenkitTranslator({ plugin: "vertexai" }))
  : new TranslationService(new GoogleTranslator(process.env.PROJECT_ID));

export const translateString =
  translationService.translateString.bind(translationService);
export const extractInput =
  translationService.extractInput.bind(translationService);
export const extractOutput =
  translationService.extractOutput.bind(translationService);
export const extractLanguages =
  translationService.extractLanguages.bind(translationService);
export const filterLanguagesFn =
  translationService.filterLanguagesFn.bind(translationService);
export const updateTranslations =
  translationService.updateTranslations.bind(translationService);
