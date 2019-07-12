import config from "./config";

export const accessTokenLoaded = () => {
  console.log("Loaded access token");
};

export const accessTokenLoading = () => {
  console.log("Loading access token");
};

export const complete = () => {
  console.log("Completed mod execution");
};

export const diffGenerating = () => {
  console.log(`Generating diff between versions`);
};

export const error = (err: Error) => {
  console.error("Error when sending remote config to slack", err);
};

export const init = () => {
  console.log("Initialising mod with configuration", config);
};

export const recentTemplatesLoaded = (version: number) => {
  console.log(`Loaded recent templates at version: ${version}`);
};

export const recentTemplatesLoading = (version: number) => {
  console.log(`Loading recent templates at version: ${version}`);
};

export const slackMessageGenerating = () => {
  console.log("Generating message to send to Slack");
};

export const slackMessageSending = () => {
  console.log("Sending message to Slack");
};

export const slackMessageSent = () => {
  console.log("Sent message to Slack");
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};
