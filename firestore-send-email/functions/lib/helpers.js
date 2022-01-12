"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSmtpCredentials = void 0;
const nodemailer_1 = require("nodemailer");
const url_1 = require("url");
exports.setSmtpCredentials = (config) => {
    const { smtpConnectionUri, smtpPassword } = config;
    let url = new url_1.URL(smtpConnectionUri);
    let transport;
    if (!url) {
        transport = null;
    }
    if (url.hostname && smtpPassword) {
        url.password = smtpPassword;
    }
    transport = nodemailer_1.createTransport(url.href);
    return transport;
};
