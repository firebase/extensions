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

import sharp from "sharp";

/**
 * libvips loader classes for the formats in `supportedContentTypes`
 * (jpeg, png, tiff, webp, gif, avif). Everything else stays blocked.
 */
export const allowedLoaders = [
  "VipsForeignLoadJpeg",
  "VipsForeignLoadPng",
  "VipsForeignLoadTiff",
  "VipsForeignLoadWebp",
  "VipsForeignLoadNsgif",
  "VipsForeignLoadHeif",
];

/**
 * Restricts libvips to the loaders for the supported formats.
 *
 * `shouldResize` filters on the object's contentType, which is metadata the
 * uploader sets, while libvips picks the loader from the file bytes. Without
 * this, an SVG, PDF or any other decodable file uploaded under a supported
 * contentType is still handed to the loader for its real format. Blocking the
 * `VipsForeignLoad` base class and re-enabling the supported loaders keeps
 * the two checks consistent whatever the declared type says.
 */
export function restrictLoaders(): void {
  sharp.block({ operation: ["VipsForeignLoad"] });
  sharp.unblock({ operation: allowedLoaders });
}
