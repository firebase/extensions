/*
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

import type { UserRecord } from "firebase-functions/v1/auth";
import type { CloudEvent, CloudFunction } from "firebase-functions/v2";

/**
 * `onUserDeleted` ships in firebase-functions 7.3.2 and emits a `gcfv2`
 * endpoint, but is absent from the published type declarations. Remove this
 * file once the types catch up.
 */
declare module "firebase-functions/v2/identity" {
  export function onUserDeleted(
    handler: (event: CloudEvent<UserRecord>) => unknown
  ): CloudFunction<CloudEvent<UserRecord>>;
}
