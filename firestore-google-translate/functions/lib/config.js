"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    languages: process.env.LANGUAGES.split(","),
    messageFieldName: process.env.MESSAGE_FIELD_NAME,
    translationsFieldName: process.env.TRANSLATIONS_FIELD_NAME,
};
