/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
