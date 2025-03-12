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
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export class Logger {
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel | string = LogLevel.INFO) {
    this.setLogLevel(logLevel);
  }

  setLogLevel(logLevel: LogLevel | string): void {
    if (typeof logLevel === "string") {
      this.logLevel = logLevel.toLowerCase() as LogLevel;
    }
    else this.logLevel = logLevel;
  }

  debug(...args: any[]): void {
    if (this.logLevel === LogLevel.DEBUG) {
      funcsLogger.debug(...args);
    }
  }

  log(...args: any[]): void {
    this.info(...args);
  }

  info(...args: any[]): void {
    if (
      this.logLevel === LogLevel.DEBUG ||
      this.logLevel === LogLevel.INFO
    ) {
      funcsLogger.info(...args);
    }
  }

  warn(...args: any[]): void {
    if (
      this.logLevel === LogLevel.DEBUG ||
      this.logLevel === LogLevel.INFO ||
      this.logLevel === LogLevel.WARN
    ) {
      funcsLogger.warn(...args);
    }
  }

  error(...args: any[]): void {
    funcsLogger.error(...args);
  }
}

export const logger = new Logger();
