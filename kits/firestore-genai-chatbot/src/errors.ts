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

import type { GoogleError } from "google-gax";

interface GoogleErrorWithReason extends GoogleError {
  reason: string;
}

function isGoogleErrorWithReason(e: Error): e is GoogleErrorWithReason {
  return (e as GoogleErrorWithReason).reason !== undefined;
}

enum GoogleErrorReason {
  ACCESS_TOKEN_SCOPE_INSUFFICIENT = "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
}

/**
 * Maps an unknown error to a user-facing message written to the message doc.
 *
 * @param e - The thrown error.
 * @returns A safe, human-readable error message.
 */
export function createErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) {
    return "Unknown Error. Please look to function logs for more details.";
  }

  if (isGoogleErrorWithReason(e)) {
    switch (e.reason) {
      case GoogleErrorReason.ACCESS_TOKEN_SCOPE_INSUFFICIENT:
        return "The project or service account likely does not have access to the Gemini API.";
      default:
        return `An error occurred while processing the provided message, ${e.message}`;
    }
  }
  return `An error occurred while processing the provided message, ${e.message}`;
}
