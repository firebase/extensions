import { Logger, LogLevel, logger as defaultLogger } from "../src/logger";
import { logger as funcsLogger } from "firebase-functions";

// Mock firebase-functions logger functions
jest.mock("firebase-functions", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Logger", () => {
  let log: Logger;

  beforeEach(() => {
    // Create a new instance before each test
    log = new Logger(LogLevel.DEBUG);
    jest.clearAllMocks();
  });

  describe("log level methods", () => {
    test("debug should call funcsLogger.debug when level is DEBUG", () => {
      log.setLogLevel(LogLevel.DEBUG);
      log.debug("debug message");
      expect(funcsLogger.debug).toHaveBeenCalledWith("debug message");
    });

    test("debug should not call funcsLogger.debug when level is INFO", () => {
      log.setLogLevel(LogLevel.INFO);
      log.debug("debug message");
      expect(funcsLogger.debug).not.toHaveBeenCalled();
    });

    test("info should call funcsLogger.info when level is INFO or lower", () => {
      log.setLogLevel(LogLevel.INFO);
      log.info("info message");
      expect(funcsLogger.info).toHaveBeenCalledWith("info message");
    });

    test("warn should call funcsLogger.warn when level is WARN or lower", () => {
      log.setLogLevel(LogLevel.WARN);
      log.warn("warn message");
      expect(funcsLogger.warn).toHaveBeenCalledWith("warn message");
    });

    test("error should call funcsLogger.error when level is ERROR or lower", () => {
      log.setLogLevel(LogLevel.ERROR);
      log.error("error message");
      expect(funcsLogger.error).toHaveBeenCalledWith("error message");
    });

    test("no logging should occur when log level is SILENT", () => {
      log.setLogLevel(LogLevel.SILENT);
      log.debug("debug message");
      log.info("info message");
      log.warn("warn message");
      log.error("error message");
      expect(funcsLogger.debug).not.toHaveBeenCalled();
      expect(funcsLogger.info).not.toHaveBeenCalled();
      expect(funcsLogger.warn).not.toHaveBeenCalled();
      expect(funcsLogger.error).not.toHaveBeenCalled();
    });
  });
});
