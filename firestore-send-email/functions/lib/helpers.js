"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSmtpCredentials = void 0;
const nodemailer_1 = require("nodemailer");
const url_1 = require("url");
exports.setSmtpCredentials = (config) => {
    const { smtpConnectionUri, smtpPassword } = config;
    let url = new url_1.URL(smtpConnectionUri);
    let smtpCredentials;
    if (!url) {
        return (smtpCredentials = null);
    }
    if (smtpConnectionUri) {
        smtpCredentials = nodemailer_1.createTransport({
            host: decodeURIComponent(url.hostname),
            port: parseInt(url.port),
            secure: url.protocol.includes("smtps") ? true : false,
            auth: {
                user: decodeURIComponent(url.username),
                pass: smtpPassword || encodeURIComponent(url.password),
            },
        });
    }
    return smtpCredentials;
};
