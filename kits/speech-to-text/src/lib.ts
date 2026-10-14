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

/**
 * Public library surface, in two tiers:
 *
 * - {@link handleObjectFinalized} — the raw handler, for consumers who want to
 *   own trigger registration.
 * - {@link transcodeToLinear16} / {@link transcribeAndUpload} — the
 *   framework-agnostic transcription engine.
 *
 * Importing this module has no side effects (it reads no environment), so it is
 * safe to import anywhere. The clone-and-deploy entry point (`./index`) is the
 * one that reads env params and registers functions.
 */

// Config types and helpers
export {
  type DeployTimeOptions,
  type ResolvedSpeechToTextConfig,
  resolveConfig,
  type SpeechToTextConfig,
  type SpeechToTextMemory,
} from "./export-config";
// Tier 2 — handler
export { type HandlerContext, handleObjectFinalized } from "./handlers";
// Tier 1 — transcription engine
export {
  type SpeechOptions,
  transcodeToLinear16,
  transcribeAndUpload,
  uploadTranscodedFile,
} from "./transcribe";
// Result types
export {
  type Failure,
  FailureType,
  Status,
  type TranscodeAudioResult,
  type TranscribeAudioResult,
  type TranscribeAudioSuccess,
  type UploadAudioResult,
  WarningType,
} from "./types";
