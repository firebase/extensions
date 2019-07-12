import config from "./config";

export const complete = () => {
  console.log("Completed mod execution");
};

export const error = (err: Error) => {
  console.error("Error sending message to Slack", err);
};

export const init = () => {
  console.log("Initialising mod with configuration", config);
};

export const messageSending = (url: string) => {
  console.log(`Sending message to Slack URL: '${url}'`);
};

export const messageSent = (url: string) => {
  console.log(`Sent message to Slack URL: '${url}'`);
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};
