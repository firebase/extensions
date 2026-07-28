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

import type { DocumentSnapshot } from "firebase-admin/firestore";
import { z } from "zod";
import { logger } from "./logger";

const intSchema = z.union([
  z.string().transform((arg) => parseInt(arg, 10) || undefined),
  z.number(),
]);
const floatSchema = z.union([z.string().transform(parseFloat), z.number()]);

const overridesSchema = z.object({
  context: z.string().optional(),
  model: z.string().optional(),
  topK: intSchema.optional(),
  candidateCount: intSchema.optional(),
  maxOutputTokens: intSchema.optional(),
  topP: floatSchema.optional(),
  temperature: floatSchema.optional(),
});

/**
 * Parses per-discussion option overrides from the parent discussion document.
 *
 * @param docSnap - The parent discussion document snapshot.
 * @returns The validated overrides.
 */
export function extractOverrides(
  docSnap: DocumentSnapshot
): Record<string, unknown> {
  const data = docSnap.data();

  try {
    return overridesSchema.parse(data);
  } catch (e) {
    logger.error("Error parsing overrides from parent doc", e);
    throw new Error("Error parsing overrides from parent doc.");
  }
}
