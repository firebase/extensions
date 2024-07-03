const TIMEOUT_SECONDS = 540;
const THRESHOLD_SECONDS = TIMEOUT_SECONDS * 0.5;

export const isTimeExceeded = (startTime: number): boolean => {
  const elapsedSeconds = (performance.now() - startTime) / 1000;
  return elapsedSeconds >= THRESHOLD_SECONDS;
};
