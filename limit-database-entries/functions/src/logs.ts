import config from "./config";

export const childCount = (path: string, childCount: number) => {
  console.log(`Node: '${path}' has: ${childCount} children`);
};

export const complete = () => {
  console.log("Completed mod execution");
};

export const error = (err: Error) => {
  console.error("Error whilst truncating the database node", err);
};

export const init = () => {
  console.log("Initialising mod with configuration", config);
};

export const pathSkipped = (path: string) => {
  console.log(`Path: '${path}' does not need to be truncated`);
};

export const pathTruncated = (path: string, count: number) => {
  console.log(`Truncated path: '${path}' to ${count} items`);
};

export const pathTruncating = (path: string, count: number) => {
  console.log(`Truncating path: '${path}' to ${count} items`);
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};
