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

// Imported from the narrow subpath, not the `firebase-functions` barrel, which
// pulls in the RTDB provider. See the note in `./index`.
import * as logger from "firebase-functions/logger";
import type { LogLevel } from "./capture-config";

const SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

let threshold = SEVERITY.info;

/**
 * Sets the minimum severity that will be emitted.
 *
 * @param level - The configured log level.
 */
export function setLogLevel(level: LogLevel): void {
  threshold = SEVERITY[level] ?? SEVERITY.info;
}

/** Logs at debug severity. */
export function debug(message: string, data?: unknown): void {
  if (threshold <= SEVERITY.debug) logger.debug(message, data);
}

/** Logs at info severity. */
export function info(message: string, data?: unknown): void {
  if (threshold <= SEVERITY.info) logger.info(message, data);
}

/** Logs at warn severity. */
export function warn(message: string, data?: unknown): void {
  if (threshold <= SEVERITY.warn) logger.warn(message, data);
}

/** Logs at error severity. */
export function error(message: string, err?: unknown): void {
  if (threshold <= SEVERITY.error) logger.error(message, err);
}
