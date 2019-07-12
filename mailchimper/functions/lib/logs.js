"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const obfuscatedConfig = Object.assign({}, config_1.default, { mailchimpApiKey: "********" });
exports.complete = () => {
    console.log("Completed mod execution");
};
exports.errorAddUser = (err) => {
    console.error("Error adding user to Mailchimp list", err);
};
exports.errorRemoveUser = (err) => {
    console.error("Error removing user from Mailchimp list", err);
};
exports.init = () => {
    console.log("Initialising mod with configuration", obfuscatedConfig);
};
exports.start = () => {
    console.log("Started mod execution with configuration", obfuscatedConfig);
};
exports.userAdded = (userId, audienceId, mailchimpId) => {
    console.log(`Added user: ${userId} to Mailchimp audience: ${audienceId} with Mailchimp ID: ${mailchimpId}`);
};
exports.userAdding = (userId, audienceId) => {
    console.log(`Adding user: ${userId} to Mailchimp audience: ${audienceId}`);
};
exports.userNoEmail = () => {
    console.log("User does not have an email");
};
exports.userRemoved = (userId, hashedEmail, audienceId) => {
    console.log(`Removed user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`);
};
exports.userRemoving = (userId, hashedEmail, audienceId) => {
    console.log(`Removing user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`);
};
