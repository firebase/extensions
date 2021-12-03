"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSmtpCredentials = void 0;
const nodemailer_1 = require("nodemailer");
exports.setSmtpCredentials = (config) => {
    const { smtpConnectionUri, smtpServerDomain, // eg.smtp.gmail.com:465
    smtpServerSSL, smtpEmail, smtpPassword, } = config;
    let smtpCredentials;
    if (!!smtpConnectionUri && !smtpServerDomain) {
        // deprecated smtp settings version after 0.1.12
        smtpCredentials = nodemailer_1.createTransport(smtpConnectionUri);
    }
    else if (!!smtpServerDomain) {
        // recommended smtp setting from version 0.1.13
        const [serverHost, serverPort] = smtpServerDomain.split(":");
        smtpCredentials = nodemailer_1.createTransport({
            host: serverHost,
            port: parseInt(serverPort),
            secure: smtpServerSSL,
            auth: {
                user: smtpEmail,
                pass: smtpPassword,
            },
        });
    }
    else {
        smtpCredentials = null;
    }
    return smtpCredentials;
};
