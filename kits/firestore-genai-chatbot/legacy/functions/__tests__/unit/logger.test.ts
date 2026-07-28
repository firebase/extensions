/**
 * Copyright 2023 Google LLC
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

import { logger as firebaseLogger } from "firebase-functions";
import { Logger, LogLevel, logger } from "../../src/logger";

jest.mock("firebase-functions", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    (Logger as any).instance = undefined;
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance on multiple getInstance calls", () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Log Levels", () => {
    it("should default to INFO level", () => {
      const instance = Logger.getInstance();
      expect(instance["currentLogLevel"]).toBe(LogLevel.INFO);
    });

    it("should allow changing log level", () => {
      const instance = Logger.getInstance();
      instance.setLogLevel(LogLevel.DEBUG);
      expect(instance["currentLogLevel"]).toBe(LogLevel.DEBUG);
    });
  });

  describe("Logging Behavior", () => {
    const testMessage = "test message";
    const testArgs = [{ key: "value" }];

    describe("DEBUG level", () => {
      it("should log when level is DEBUG", () => {
        logger.setLogLevel(LogLevel.DEBUG);
        logger.debug(testMessage, ...testArgs);
        expect(firebaseLogger.debug).toHaveBeenCalledWith(
          "[firestore-genai-chatbot] test message",
          ...testArgs
        );
      });

      it("should not log when level is higher than DEBUG", () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.debug(testMessage, ...testArgs);
        expect(firebaseLogger.debug).not.toHaveBeenCalled();
      });
    });

    describe("INFO level", () => {
      it("should log when level is INFO", () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.info(testMessage, ...testArgs);
        expect(firebaseLogger.info).toHaveBeenCalledWith(
          "[firestore-genai-chatbot] test message",
          ...testArgs
        );
      });

      it("should not log when level is higher than INFO", () => {
        logger.setLogLevel(LogLevel.WARN);
        logger.info(testMessage, ...testArgs);
        expect(firebaseLogger.info).not.toHaveBeenCalled();
      });
    });

    describe("WARN level", () => {
      it("should log when level is WARN", () => {
        logger.setLogLevel(LogLevel.WARN);
        logger.warn(testMessage, ...testArgs);
        expect(firebaseLogger.warn).toHaveBeenCalledWith(
          "[firestore-genai-chatbot] test message",
          ...testArgs
        );
      });

      it("should not log when level is higher than WARN", () => {
        logger.setLogLevel(LogLevel.ERROR);
        logger.warn(testMessage, ...testArgs);
        expect(firebaseLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe("ERROR level", () => {
      it("should log when level is ERROR", () => {
        logger.setLogLevel(LogLevel.ERROR);
        logger.error(testMessage, ...testArgs);
        expect(firebaseLogger.error).toHaveBeenCalledWith(
          "[firestore-genai-chatbot] test message",
          ...testArgs
        );
      });

      it("should always log errors regardless of level", () => {
        logger.setLogLevel(LogLevel.DEBUG);
        logger.error(testMessage, ...testArgs);
        expect(firebaseLogger.error).toHaveBeenCalledWith(
          "[firestore-genai-chatbot] test message",
          ...testArgs
        );
      });
    });
  });

  describe("Message Formatting", () => {
    it("should format messages with the correct prefix", () => {
      logger.setLogLevel(LogLevel.INFO);
      logger.info("test message");
      expect(firebaseLogger.info).toHaveBeenCalledWith(
        "[firestore-genai-chatbot] test message"
      );
    });

    it("should handle multiple arguments correctly", () => {
      logger.setLogLevel(LogLevel.INFO);
      const arg1 = { key: "value" };
      const arg2 = ["array"];
      logger.info("test message", arg1, arg2);
      expect(firebaseLogger.info).toHaveBeenCalledWith(
        "[firestore-genai-chatbot] test message",
        arg1,
        arg2
      );
    });

    it("should handle error objects correctly", () => {
      logger.setLogLevel(LogLevel.ERROR);
      const error = new Error("test error");
      logger.error("test message", error);
      expect(firebaseLogger.error).toHaveBeenCalledWith(
        "[firestore-genai-chatbot] test message",
        error
      );
    });
  });

  describe("Log Level Hierarchy", () => {
    it("should respect log level hierarchy", () => {
      logger.setLogLevel(LogLevel.WARN);

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(firebaseLogger.debug).not.toHaveBeenCalled();
      expect(firebaseLogger.info).not.toHaveBeenCalled();
      expect(firebaseLogger.warn).toHaveBeenCalled();
      expect(firebaseLogger.error).toHaveBeenCalled();
    });

    it("should allow all levels when set to DEBUG", () => {
      logger.setLogLevel(LogLevel.DEBUG);

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(firebaseLogger.debug).toHaveBeenCalled();
      expect(firebaseLogger.info).toHaveBeenCalled();
      expect(firebaseLogger.warn).toHaveBeenCalled();
      expect(firebaseLogger.error).toHaveBeenCalled();
    });
  });
});
