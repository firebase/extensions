/*
 * Copyright 2019 Google LLC
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

import type { Role } from "firebase-functions/v2";
import { requiresRole } from "firebase-functions/v2";
import { configFromEnv } from "./config";
import { defineStorageResizeImages } from "./factory";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/storage.admin",
  "roles/aiplatform.user",
  // Gen2 Storage triggers need Eventarc receive on the function SA.
  "roles/eventarc.eventReceiver",
];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

export const { generateResizedImage } = defineStorageResizeImages(
  configFromEnv()
);
