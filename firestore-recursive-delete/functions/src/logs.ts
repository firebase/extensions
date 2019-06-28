const configuration = () => ({
  location: process.env.LOCATION,
});

export const deletePath = (userId: string, path: string) => {
  console.log(`User: ${userId} has requested to delete path: '${path}'`);
};

export const error = (path: string, e: Error) => {
  console.error(`Error when trying to delete: '${path}'`, e);
};

export const init = () => {
  console.log("Initialising mod with configuration", configuration());
};

export const pathMissing = () => {
  console.warn("Unable to delete, no 'path' is specified");
};

export const start = () => {
  console.log("Started mod execution with configuration", configuration());
};

export const success = (path: string) => {
  console.log(`Path: '${path}' was successfully deleted`);
};

export const userMissingClaim = () => {
  console.warn(
    "Unable to delete, the user does not have the 'fsdelete' custom claim"
  );
};

export const userUnauthenticated = () => {
  console.warn("Unable to delete, the user is unauthenticated");
};
