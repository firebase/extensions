import * as admin from "firebase-admin";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import sharp from "sharp";
import * as events from "./events";
import {
  type ResizeImagesConfig,
  resolveResizeImagesConfig,
} from "./export-config";
import { type HandlerContext, handleObjectFinalized } from "./handlers";
import * as logs from "./logs";

export function defineStorageResizeImages(config: ResizeImagesConfig) {
  const resolved = resolveResizeImagesConfig(config);

  sharp.cache(false);
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }

  events.setupEventChannel();
  logs.init(resolved);

  const ctx: HandlerContext = {
    config: resolved,
    storage: admin.storage(),
  };

  const generateResizedImage = onObjectFinalized(
    {
      bucket: resolved.bucket,
      region: resolved.region,
      memory: resolved.memory,
    },
    (event) => handleObjectFinalized(event, ctx)
  );

  return { generateResizedImage };
}
