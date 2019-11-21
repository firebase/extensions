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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const bitly_1 = require("bitly");
const abstract_shortener_1 = require("./abstract-shortener");
const config_1 = require("./config");
const logs = require("./logs");
class FirestoreBitlyUrlShortener extends abstract_shortener_1.FirestoreUrlShortener {
    constructor(urlFieldName, shortUrlFieldName, bitlyAccessToken) {
        super(urlFieldName, shortUrlFieldName);
        this.bitly = new bitly_1.BitlyClient(bitlyAccessToken);
        logs.init();
    }
    shortenUrl(snapshot) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.extractUrl(snapshot);
            logs.shortenUrl(url);
            try {
                const response = yield this.bitly.shorten(url);
                const { url: shortUrl } = response;
                logs.shortenUrlComplete(shortUrl);
                yield this.updateShortUrl(snapshot, shortUrl);
            }
            catch (err) {
                logs.error(err);
            }
        });
    }
}
const urlShortener = new FirestoreBitlyUrlShortener(config_1.default.urlFieldName, config_1.default.shortUrlFieldName, config_1.default.bitlyAccessToken);
exports.fsurlshortener = functions.handler.firestore.document.onWrite((change) => __awaiter(this, void 0, void 0, function* () {
    return urlShortener.onDocumentWrite(change);
}));
