export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked = [];
  const arrayCopy = [...array];
  while (arrayCopy.length) {
    chunked.push(arrayCopy.splice(0, size));
  }
  return chunked;
}

const TIMEOUT_SECONDS = 540;
const THRESHOLD_SECONDS = TIMEOUT_SECONDS * 0.5;

export const isTimeExceeded = (startTime: number): boolean => {
  const elapsedSeconds = (performance.now() - startTime) / 1000;
  return elapsedSeconds >= THRESHOLD_SECONDS;
};
