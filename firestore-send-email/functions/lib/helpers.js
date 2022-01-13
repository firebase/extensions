"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSmtpCredentials = void 0;
const nodemailer_1 = require("nodemailer");
const url_1 = require("url");
const logs_1 = require("./logs");
exports.setSmtpCredentials = (config) => {
    const { smtpConnectionUri, smtpPassword } = config;
    let url = new url_1.URL(smtpConnectionUri);
    let transport;
    if (!url) {
        logs_1.invalidURI(smtpConnectionUri);
        return null;
    }
    if (url.hostname && smtpPassword) {
        url.password = smtpPassword;
    }
    transport = nodemailer_1.createTransport(url.href);
    return transport;
};
