import { logger } from "firebase-functions";

export const mockConsoleLog = jest.spyOn(logger, "log").mockImplementation();

export const mockConsoleError = jest
  .spyOn(logger, "error")
  .mockImplementation();
