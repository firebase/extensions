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

// Cloud Storage multi-region locations are not Cloud Run regions; deploying a
// function to one hard-fails, so they map to a region inside the multi-region.
// These are the same targets firebase-tools picks when it resolves a bucket
// trigger's region itself, so the mapping stays a no-op if placement ever moves
// back to the CLI.
const MULTI_REGION_TO_FUNCTION_REGION: Record<string, string> = {
  us: "us-east1",
  eu: "europe-west1",
  asia: "asia-east1",
};

// Cloud Functions has no location in these, and a 2nd gen storage trigger
// cannot cross regions. The CLI does not check `.env` values against the
// BUCKET_REGION options, so a hand-written one must be rejected here.
const UNSUPPORTED_LOCATIONS = ["europe-north2", "northamerica-south1"];

/**
 * Maps a Cloud Storage bucket location to the Cloud Run region the functions
 * should deploy to. The lookup is case-insensitive and ignores surrounding
 * whitespace, as the CLI's own region handling is. Regional locations pass
 * through lowercased; an unset or blank location returns `undefined`, meaning
 * the functions declare no region. Throws for a location Cloud Functions
 * cannot serve.
 *
 * Dual-region locations (`nam4`, `eur4`, `asia1`, ...) are not mapped and pass
 * through, which fails the deploy. firebase-tools has the same gap, so a
 * dual-region bucket needs the region chosen by hand. One half of the pair is
 * enough: a `us-central1` function receives a `nam4` bucket's events, with
 * Eventarc placing the trigger in `nam4`.
 */
export function bucketLocationToFunctionRegion(
  location: string | undefined
): string | undefined {
  const normalized = location?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (UNSUPPORTED_LOCATIONS.includes(normalized)) {
    throw new Error(
      `BUCKET_REGION ${normalized} is not supported: Cloud Functions has no location there, so the kit cannot serve a bucket in it.`
    );
  }
  return MULTI_REGION_TO_FUNCTION_REGION[normalized] ?? normalized;
}
