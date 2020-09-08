"use strict";
/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fsurlshortener = void 0;
const functions = require("firebase-functions");
const axios_1 = require("axios");
const abstract_shortener_1 = require("./abstract-shortener");
const config_1 = require("./config");
const logs = require("./logs");
class FirestoreBitlyUrlShortener extends abstract_shortener_1.FirestoreUrlShortener {
    constructor(urlFieldName, shortUrlFieldName, bitlyAccessToken) {
        super(urlFieldName, shortUrlFieldName);
        this.instance = axios_1.default.create({
            headers: {
                Authorization: `Bearer ${bitlyAccessToken}`,
                "Content-Type": "application/json",
            },
            baseURL: "https://api-ssl.bitly.com/v4/",
        });
        logs.init();
    }
    async shortenUrl(snapshot) {
        const url = this.extractUrl(snapshot);
        logs.shortenUrl(url);
        try {
            const response = await this.instance.post("bitlinks", {
                long_url: url,
            });
            const { link } = response.data;
            logs.shortenUrlComplete(link);
            await this.updateShortUrl(snapshot, link);
        }
        catch (err) {
            logs.error(err);
        }
    }
}
const urlShortener = new FirestoreBitlyUrlShortener(config_1.default.urlFieldName, config_1.default.shortUrlFieldName, config_1.default.bitlyAccessToken);
exports.fsurlshortener = functions.handler.firestore.document.onWrite(async (change) => {
    return urlShortener.onDocumentWrite(change);
});
