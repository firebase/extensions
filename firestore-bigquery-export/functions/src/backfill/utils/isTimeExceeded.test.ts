import { isTimeExceeded } from "./isTimeExceeded";

describe("isTimeExceeded", () => {
  const TIMEOUT_SECONDS = 540;
  const THRESHOLD_SECONDS = TIMEOUT_SECONDS * 0.5;

  beforeEach(() => {
    jest.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns false if elapsed time is less than THRESHOLD_SECONDS", () => {
    const startTime = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValue(startTime + THRESHOLD_SECONDS * 1000 - 1);
    expect(isTimeExceeded(startTime)).toBe(false);
  });

  test("returns true if elapsed time is equal to THRESHOLD_SECONDS", () => {
    const startTime = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValue(startTime + THRESHOLD_SECONDS * 1000);
    expect(isTimeExceeded(startTime)).toBe(true);
  });

  test("returns true if elapsed time is greater than THRESHOLD_SECONDS", () => {
    const startTime = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValue(startTime + THRESHOLD_SECONDS * 1000 + 1);
    expect(isTimeExceeded(startTime)).toBe(true);
  });
});
