import config from "./config";

const obfuscatedConfig = {
  ...config,
  mailchimpApiKey: "********",
};

export const complete = () => {
  console.log("Completed mod execution");
};

export const errorAddUser = (err: Error) => {
  console.error("Error adding user to Mailchimp list", err);
};

export const errorRemoveUser = (err: Error) => {
  console.error("Error removing user from Mailchimp list", err);
};

export const init = () => {
  console.log("Initialising mod with configuration", obfuscatedConfig);
};

export const start = () => {
  console.log("Started mod execution with configuration", obfuscatedConfig);
};

export const userAdded = (
  userId: string,
  audienceId: string,
  mailchimpId: string
) => {
  console.log(
    `Added user: ${userId} to Mailchimp audience: ${audienceId} with Mailchimp ID: ${mailchimpId}`
  );
};

export const userAdding = (userId: string, audienceId: string) => {
  console.log(`Adding user: ${userId} to Mailchimp audience: ${audienceId}`);
};

export const userNoEmail = () => {
  console.log("User does not have an email");
};

export const userRemoved = (
  userId: string,
  hashedEmail: string,
  audienceId: string
) => {
  console.log(
    `Removed user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`
  );
};

export const userRemoving = (
  userId: string,
  hashedEmail: string,
  audienceId: string
) => {
  console.log(
    `Removing user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`
  );
};
