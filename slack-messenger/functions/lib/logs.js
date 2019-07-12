"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.complete = () => {
    console.log("Completed mod execution");
};
exports.error = (err) => {
    console.error("Error sending message to Slack", err);
};
exports.init = () => {
    console.log("Initialising mod with configuration", config_1.default);
};
exports.messageSending = (url) => {
    console.log(`Sending message to Slack URL: '${url}'`);
};
exports.messageSent = (url) => {
    console.log(`Sent message to Slack URL: '${url}'`);
};
exports.start = () => {
    console.log("Started mod execution with configuration", config_1.default);
};
