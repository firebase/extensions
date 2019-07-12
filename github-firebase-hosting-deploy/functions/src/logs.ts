import config from "./config";

export const accessTokenLoaded = () => {
  console.log("Loaded access token");
};

export const accessTokenLoading = () => {
  console.log("Loading access token");
};

export const branchSkip = (requestedBranch: string, expectedBranch: string) => {
  console.log(
    `Branch: '${requestedBranch}' does not match the deployment branch: '${expectedBranch}', no processing required`
  );
};

export const commitLoaded = (commit: string) => {
  console.log(`Loaded commit: '${commit}'`);
};

export const commitLoading = (commit: string) => {
  console.log(`Loading commit: '${commit}'`);
};

export const complete = () => {
  console.log("Completed mod execution");
};

export const deploymentManifest = (manifest: string) => {
  console.log(`Deployment manifest: ${manifest}`);
};

export const error = (err: Error) => {
  console.error("Error when deploying site", err);
};

export const errorDeleting = (err: Error) => {
  console.warn("There was a problem deleting temporary files", err);
};

export const filesPublished = () => {
  console.log("Published files to Firebase Hosting");
};

export const filesPublishing = () => {
  console.log("Publishing files to Firebase Hosting");
};

export const fileUploaded = (hash: string) => {
  console.log(`Uploaded file: ${hash}`);
};

export const fileUploading = (hash: string) => {
  console.log(`Uploading file: ${hash}`);
};

export const init = () => {
  console.log("Initialising mod with configuration", config);
};

export const repositoryCloned = (repository: string, path: string) => {
  console.log(`Cloned repository: '${repository}' to path: '${path}'`);
};

export const repositoryCloning = (repository: string, path: string) => {
  console.log(`Cloning repository: '${repository}' to path: '${path}'`);
};

export const requestedFilesLoaded = (files: string) => {
  console.log(`Loaded Firebase Hosting requested files: ${files}`);
};

export const requestedFilesLoading = () => {
  console.log(`Loading Firebase Hosting requested files`);
};

export const released = (version: string) => {
  console.log(`Released version: '${version}' to Firebase Hosting`);
};

export const releasing = (version: string) => {
  console.log(`Releasing version: '${version}' to Firebase Hosting`);
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};

export const tempFilesDeleted = () => {
  console.log("Deleted temporary files");
};

export const tempFilesDeleting = () => {
  console.log("Deleting temporary files");
};

export const uploadFinalized = () => {
  console.log("Finalized upload with Firebase Hosting");
};

export const uploadFinalizing = () => {
  console.log("Finalizing upload with Firebase Hosting");
};

export const versionLoaded = (version: string) => {
  console.log(`Loaded Firebase Hosting site version: '${version}'`);
};

export const versionLoading = () => {
  console.log("Loading Firebase Hosting site version");
};
