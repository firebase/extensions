import { Bucket } from "@google-cloud/storage";

import * as log from "./logs";
import {
  replaceWithConfiguredPlaceholder,
  replaceWithDefaultPlaceholder,
} from "./util";

/**
 * Swaps the local file with a placeholder image. Uses the configured
 * placeholder at `placeholderImagePath` when provided, otherwise the bundled
 * default.
 */
export async function replacePlaceholder(
  localFile: string,
  bucket: Bucket,
  placeholderImagePath: string | null
): Promise<void> {
  if (placeholderImagePath) {
    log.replacingWithConfiguredPlaceholder(placeholderImagePath);
    await replaceWithConfiguredPlaceholder(
      localFile,
      bucket,
      placeholderImagePath
    );
  } else {
    log.replacingWithDefaultPlaceholder();
    await replaceWithDefaultPlaceholder(localFile);
  }
  log.placeholderReplaceComplete(localFile);
}
