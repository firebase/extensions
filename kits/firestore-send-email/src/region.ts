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

// Locations where deploying a function hard-fails. Firestore multi-regions are
// not Cloud Run regions, so they map to a region inside the multi-region.
// `europe-north2` and `northamerica-south1` have no Cloud Functions, so they map
// to the nearest region that does. A Firestore trigger can reach a function in
// another region, so the trigger still fires in the database's own location.
const LOCATION_TO_FUNCTION_REGION: Record<string, string> = {
  nam5: "us-central1",
  nam7: "us-central1",
  eur3: "europe-west1",
  "europe-north2": "europe-north1",
  "northamerica-south1": "us-south1",
};

/**
 * Maps a Firestore database location to the Cloud Run region the functions
 * should deploy to. The lookup is case-insensitive and ignores surrounding
 * whitespace, as the CLI's own region handling is. Other regional locations
 * pass through lowercased; an unset or blank location returns `undefined`, meaning
 * the functions declare no region.
 */
export function firestoreLocationToFunctionRegion(
  location: string | undefined
): string | undefined {
  const normalized = location?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return LOCATION_TO_FUNCTION_REGION[normalized] ?? normalized;
}
