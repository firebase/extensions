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

// Firestore multi-region locations are not Cloud Run regions; deploying a
// function to one hard-fails, so they map to a region inside the multi-region.
const MULTI_REGION_TO_FUNCTION_REGION: Record<string, string> = {
  nam5: "us-central1",
  nam7: "us-central1",
  eur3: "europe-west1",
};

/**
 * Maps a Firestore database location to the Cloud Run region the functions
 * should deploy to. Regional locations pass through unchanged; an unset or
 * empty location returns `undefined`, meaning the functions declare no region.
 */
export function firestoreLocationToFunctionRegion(
  location: string | undefined
): string | undefined {
  if (!location) {
    return undefined;
  }
  return MULTI_REGION_TO_FUNCTION_REGION[location] ?? location;
}
