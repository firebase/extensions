export const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();

export const mockConsoleError = jest
  .spyOn(console, "error")
  .mockImplementation();
