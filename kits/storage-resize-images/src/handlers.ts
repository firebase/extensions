import * as fs from "node:fs";
import * as path from "node:path";
import type { File } from "@google-cloud/storage";
import type * as admin from "firebase-admin";
import type { StorageEvent } from "firebase-functions/v2/storage";
import { checkImageContent } from "./content-filter";
import * as events from "./events";
import { DELETE_IMAGE, type ResolvedResizeImagesConfig } from "./export-config";
import {
  deleteRemoteFile,
  deleteTempFile,
  downloadOriginalFile,
  handleFailedImage,
} from "./file-operations";
import { shouldResize } from "./filters";
import * as logs from "./logs";
import { replacePlaceholder } from "./placeholder";
import { resizeImages } from "./resize-image";
import type { StorageObjectMetadata } from "./util";

export interface HandlerContext {
  config: ResolvedResizeImagesConfig;
  storage: ReturnType<typeof admin.storage>;
}

export async function handleObjectFinalized(
  event: StorageEvent,
  ctx: HandlerContext
): Promise<void> {
  await events.recordStartEvent(event.data as object);
  await generateResizedImageHandler(
    event.data as unknown as StorageObjectMetadata,
    ctx
  );
  await events.recordCompletionEvent({
    context: {
      eventId: event.id,
      eventType: event.type,
      resource: event.source,
      timestamp: event.time,
    },
  });
}

export async function generateResizedImageHandler(
  object: StorageObjectMetadata,
  ctx: HandlerContext,
  verbose = true
): Promise<void> {
  const { config } = ctx;
  if (verbose) logs.start(config);
  if (!shouldResize(object, config)) {
    return;
  }

  await events.recordStartResizeEvent({
    subject: object.name,
    data: { input: object },
  });

  const bucket = ctx.storage.bucket(object.bucket);
  const filePath = object.name;
  const parsedPath = path.parse(filePath);

  let localOriginalFile: string | undefined;
  let localProcessingFile: string | undefined;
  let remoteOriginalFile: File | undefined;

  try {
    [localOriginalFile, remoteOriginalFile] = await downloadOriginalFile(
      bucket,
      filePath,
      verbose
    );

    let blockedByFilter = false;
    let filterErrored = false;
    let blockedImageStored = false;

    try {
      const passed = await checkImageContent(
        localOriginalFile,
        config.contentFilterLevel,
        config.customFilterPrompt,
        object.contentType ?? "",
        config.region
      );
      if (!passed) {
        blockedByFilter = true;
        logs.contentFilterRejected(object.name);

        await handleFailedImage(
          bucket,
          localOriginalFile,
          object,
          parsedPath,
          true,
          config
        );
        blockedImageStored = true;

        localProcessingFile = `${localOriginalFile}-placeholder`;
        fs.copyFileSync(localOriginalFile, localProcessingFile);
        try {
          await replacePlaceholder(
            localProcessingFile,
            bucket,
            config.placeholderImagePath
          );
        } catch (err) {
          logs.placeholderReplaceError(err);
          filterErrored = true;
        }
      }
    } catch (err) {
      logs.contentFilterErrored(err);
      filterErrored = true;
    }

    const fileToResize = localProcessingFile ?? localOriginalFile;
    let resizeFailed = false;
    if (!filterErrored) {
      const resizeResults = await resizeImages(
        bucket,
        fileToResize,
        parsedPath,
        object,
        config
      );

      await events.recordSuccessEvent({
        subject: filePath,
        data: {
          input: object,
          outputs: resizeResults,
          contentFilterPassed: !blockedByFilter,
        },
      });

      resizeFailed = resizeResults.some(
        (result) =>
          result.status === "rejected" || result.value.success === false
      );
    }

    const failed = filterErrored || resizeFailed;

    if (failed) {
      logs.failed();
      if (!blockedImageStored) {
        await handleFailedImage(
          bucket,
          localOriginalFile,
          object,
          parsedPath,
          blockedByFilter,
          config
        );
      }
    } else {
      if (config.deleteOriginalFile === DELETE_IMAGE.onSuccess) {
        await deleteRemoteFile(remoteOriginalFile, filePath);
      }
      if (verbose) logs.complete();
    }
  } catch (err) {
    logs.error(err);
    await events.recordErrorEvent(
      err instanceof Error ? err : new Error(String(err))
    );
  } finally {
    if (localOriginalFile) {
      await deleteTempFile(localOriginalFile, filePath, verbose);
    }

    if (localProcessingFile) {
      await deleteTempFile(localProcessingFile, filePath, verbose);
    }

    if (
      config.deleteOriginalFile === DELETE_IMAGE.always &&
      remoteOriginalFile
    ) {
      await deleteRemoteFile(remoteOriginalFile, filePath);
    }
  }
}
