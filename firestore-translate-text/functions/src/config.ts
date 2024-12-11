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

export default {
  doBackfill: process.env.DO_BACKFILL === "true",
  languages: Array.from(new Set(process.env.LANGUAGES.split(","))),
  location: process.env.LOCATION,
  inputFieldName: process.env.INPUT_FIELD_NAME,
  outputFieldName: process.env.OUTPUT_FIELD_NAME,
  languagesFieldName: process.env.LANGUAGES_FIELD_NAME,
  useGenkit: process.env.TRANSLATION_MODEL === "gemini",
  geminiProvider: "googleai",
  googleAIAPIKey: process.env.GOOGLE_AI_API_KEY,
};
