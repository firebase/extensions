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

/** A response part as far as candidate parsing is concerned. */
export interface TextPart {
  text?: string;
  thought?: boolean;
}

/**
 * First non-thought text part of a candidate.
 *
 * Reading `parts[0].text` is not reliable for thinking models: they can lead
 * with thought parts, or put the answer in a later part. Thought parts carry
 * `thought: true`, which the pinned `@google/generative-ai` version does not
 * type, so callers pass their own part shape in.
 */
export function answerText(parts?: TextPart[]): string | undefined {
  return parts?.find((part) => !part.thought && typeof part.text === "string")
    ?.text;
}
