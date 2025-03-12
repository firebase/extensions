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
import { logger as funcsLogger } from "firebase-functions";

export enum LogLevel {
  DEBUG = "debug", // Will log everything
  INFO = "info", // Will log info, warnings, and errors
  WARN = "warn", // Will log warnings and errors
  ERROR = "error", // Will log errors only
  SILENT = "silent", // Won't log anything
}

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

export class Logger {
  private logLevel: number;

  constructor(logLevel: LogLevel | string | number = LogLevel.INFO) {
    this.setLogLevel(logLevel);
  }

  setLogLevel(logLevel: LogLevel | string | number): void {
    if (typeof logLevel === "string") {
      this.logLevel = levels[logLevel];
    } else if (typeof logLevel === "number") {
      this.logLevel = logLevel;
    } else {
      this.logLevel = levels[logLevel];
    }
  }

  debug(...args: any[]): void {
    this.runIfLogLevel(levels.debug, funcsLogger.debug, ...args);
  }

  info(...args: any[]): void {
    this.runIfLogLevel(levels.info, funcsLogger.info, ...args);
  }

  warn(...args: any[]): void {
    this.runIfLogLevel(levels.warn, funcsLogger.warn, ...args);
  }

  error(...args: any[]): void {
    this.runIfLogLevel(levels.error, funcsLogger.error, ...args);
  }

  log(...args: any[]): void {
    this.info(...args);
  }

  private runIfLogLevel(level: number, func: Function, ...args: any[]): void {
    if (this.logLevel <= level) {
      func(...args);
    }
  }
}

export const logger = new Logger();
