/**
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

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("firebase-functions", () => ({ logger: mocks }));

import { Logger, LogLevel, logger } from "../src/logger";

const PREFIX = "[firestore-genai-chatbot]";

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logger.setLogLevel(LogLevel.INFO);
  });

  test("getInstance returns the same instance as the exported logger", () => {
    expect(Logger.getInstance()).toBe(Logger.getInstance());
    expect(logger).toBe(Logger.getInstance());
  });

  test("a freshly loaded logger defaults to INFO", async () => {
    vi.resetModules();
    const { logger: fresh } = await vi.importActual<
      typeof import("../src/logger")
    >("../src/logger");

    fresh.debug("debug message");
    fresh.info("info message");

    expect(mocks.debug).not.toHaveBeenCalled();
    expect(mocks.info).toHaveBeenCalledWith(`${PREFIX} info message`);
  });

  describe("level filtering", () => {
    test("debug is emitted at DEBUG and suppressed at INFO", () => {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.debug("message");
      expect(mocks.debug).toHaveBeenCalledWith(`${PREFIX} message`);

      mocks.debug.mockClear();
      logger.setLogLevel(LogLevel.INFO);
      logger.debug("message");
      expect(mocks.debug).not.toHaveBeenCalled();
    });

    test("info is emitted at INFO and suppressed at WARN", () => {
      logger.info("message");
      expect(mocks.info).toHaveBeenCalledWith(`${PREFIX} message`);

      mocks.info.mockClear();
      logger.setLogLevel(LogLevel.WARN);
      logger.info("message");
      expect(mocks.info).not.toHaveBeenCalled();
    });

    test("warn is emitted at WARN and suppressed at ERROR", () => {
      logger.setLogLevel(LogLevel.WARN);
      logger.warn("message");
      expect(mocks.warn).toHaveBeenCalledWith(`${PREFIX} message`);

      mocks.warn.mockClear();
      logger.setLogLevel(LogLevel.ERROR);
      logger.warn("message");
      expect(mocks.warn).not.toHaveBeenCalled();
    });

    test("error is emitted at every level", () => {
      for (const level of Object.values(LogLevel)) {
        mocks.error.mockClear();
        logger.setLogLevel(level);
        logger.error("message");
        expect(mocks.error).toHaveBeenCalledWith(`${PREFIX} message`);
      }
    });

    test("only warn and above are emitted at WARN", () => {
      logger.setLogLevel(LogLevel.WARN);

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(mocks.debug).not.toHaveBeenCalled();
      expect(mocks.info).not.toHaveBeenCalled();
      expect(mocks.warn).toHaveBeenCalledOnce();
      expect(mocks.error).toHaveBeenCalledOnce();
    });

    test("every level is emitted at DEBUG", () => {
      logger.setLogLevel(LogLevel.DEBUG);

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(mocks.debug).toHaveBeenCalledOnce();
      expect(mocks.info).toHaveBeenCalledOnce();
      expect(mocks.warn).toHaveBeenCalledOnce();
      expect(mocks.error).toHaveBeenCalledOnce();
    });
  });

  describe("message formatting", () => {
    test("prefixes the message and forwards extra arguments", () => {
      const detail = { key: "value" };
      const items = ["array"];

      logger.info("test message", detail, items);

      expect(mocks.info).toHaveBeenCalledWith(
        `${PREFIX} test message`,
        detail,
        items
      );
    });

    test("forwards error objects unchanged", () => {
      const error = new Error("test error");

      logger.error("test message", error);

      expect(mocks.error).toHaveBeenCalledWith(`${PREFIX} test message`, error);
    });
  });
});
