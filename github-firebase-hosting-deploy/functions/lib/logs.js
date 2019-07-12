"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.accessTokenLoaded = () => {
    console.log("Loaded access token");
};
exports.accessTokenLoading = () => {
    console.log("Loading access token");
};
exports.branchSkip = (requestedBranch, expectedBranch) => {
    console.log(`Branch: '${requestedBranch}' does not match the deployment branch: '${expectedBranch}', no processing required`);
};
exports.commitLoaded = (commit) => {
    console.log(`Loaded commit: '${commit}'`);
};
exports.commitLoading = (commit) => {
    console.log(`Loading commit: '${commit}'`);
};
exports.complete = () => {
    console.log("Completed mod execution");
};
exports.deploymentManifest = (manifest) => {
    console.log(`Deployment manifest: ${manifest}`);
};
exports.error = (err) => {
    console.error("Error when deploying site", err);
};
exports.errorDeleting = (err) => {
    console.warn("There was a problem deleting temporary files", err);
};
exports.filesPublished = () => {
    console.log("Published files to Firebase Hosting");
};
exports.filesPublishing = () => {
    console.log("Publishing files to Firebase Hosting");
};
exports.fileUploaded = (hash) => {
    console.log(`Uploaded file: ${hash}`);
};
exports.fileUploading = (hash) => {
    console.log(`Uploading file: ${hash}`);
};
exports.init = () => {
    console.log("Initialising mod with configuration", config_1.default);
};
exports.repositoryCloned = (repository, path) => {
    console.log(`Cloned repository: '${repository}' to path: '${path}'`);
};
exports.repositoryCloning = (repository, path) => {
    console.log(`Cloning repository: '${repository}' to path: '${path}'`);
};
exports.requestedFilesLoaded = (files) => {
    console.log(`Loaded Firebase Hosting requested files: ${files}`);
};
exports.requestedFilesLoading = () => {
    console.log(`Loading Firebase Hosting requested files`);
};
exports.released = (version) => {
    console.log(`Released version: '${version}' to Firebase Hosting`);
};
exports.releasing = (version) => {
    console.log(`Releasing version: '${version}' to Firebase Hosting`);
};
exports.start = () => {
    console.log("Started mod execution with configuration", config_1.default);
};
exports.tempFilesDeleted = () => {
    console.log("Deleted temporary files");
};
exports.tempFilesDeleting = () => {
    console.log("Deleting temporary files");
};
exports.uploadFinalized = () => {
    console.log("Finalized upload with Firebase Hosting");
};
exports.uploadFinalizing = () => {
    console.log("Finalizing upload with Firebase Hosting");
};
exports.versionLoaded = (version) => {
    console.log(`Loaded Firebase Hosting site version: '${version}'`);
};
exports.versionLoading = () => {
    console.log("Loading Firebase Hosting site version");
};
