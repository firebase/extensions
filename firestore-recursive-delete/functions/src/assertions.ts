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

import * as httpErrors from "./errors";
import * as logs from "./logs";

export const pathExists = (path?: string) => {
  if (!path) {
    logs.pathMissing();
    throw httpErrors.invalidArgument("path");
  }
};

export const userHasClaim = (token) => {
  const hasCustomClaim = token && token.fsdelete;
  if (!hasCustomClaim) {
    logs.userMissingClaim();
    throw httpErrors.permissionDenied();
  }
};

export const userIsAuthenticated = (auth) => {
  const isAuthenticated = auth && auth.uid;
  if (!isAuthenticated) {
    logs.userUnauthenticated();
    throw httpErrors.unauthenticated();
  }
};
