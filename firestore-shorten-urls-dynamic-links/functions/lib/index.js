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
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shorten_update = exports.shorten_create = void 0;
const url_1 = require("url");
const functions = require("firebase-functions");
const node_fetch_1 = require("node-fetch");
const abstract_shortener_1 = require("./abstract-shortener");
const config_1 = require("./config");
const logs = require("./logs");
class ServiceAccountCredential {
    constructor() {
        this.metadataServiceUri = new url_1.URL("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token");
        this.requiredScopes = "https://www.googleapis.com/auth/firebase";
        const searchParams = new url_1.URLSearchParams({ scopes: this.requiredScopes });
        this.metadataServiceUri.search = searchParams.toString();
    }
    getAccessToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Math.floor(Date.now() / 1000);
            const nowish = now + 30; // 30s leeway
            if (typeof this.accessToken === "undefined" ||
                typeof this.tokenExpiration === "undefined" ||
                this.tokenExpiration < nowish) {
                const metadataResponse = yield node_fetch_1.default(this.metadataServiceUri, {
                    headers: {
                        "Metadata-Flavor": "Google",
                    },
                });
                const { access_token, expires_in } = yield metadataResponse.json();
                this.accessToken = access_token;
                this.tokenExpiration = now + expires_in;
            }
            return this.accessToken;
        });
    }
}
class FirestoreDynamicLinksUrlShortener extends abstract_shortener_1.FirestoreUrlShortener {
    constructor(urlFieldName, shortUrlFieldName, dynamicLinkUrlPrefix, dynamicLinkSuffixLength) {
        super(urlFieldName, shortUrlFieldName);
        this.dynamicLinkUrlPrefix = dynamicLinkUrlPrefix;
        this.dynamicLinkSuffixLength = dynamicLinkSuffixLength;
        this.dynamicLinksApiUrl = "https://firebasedynamiclinks.googleapis.com/v1/shortLinks";
        this.credentials = new ServiceAccountCredential();
        this.logs = logs;
        this.logs.init();
    }
    shortenUrl(snapshot) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.extractUrl(snapshot);
            this.logs.shortenUrl(url);
            const accessToken = yield this.credentials.getAccessToken();
            try {
                const requestBody = {
                    dynamicLinkInfo: {
                        domainUriPrefix: this.dynamicLinkUrlPrefix,
                        link: url,
                    },
                    suffix: { option: this.dynamicLinkSuffixLength },
                };
                const response = yield node_fetch_1.default(this.dynamicLinksApiUrl, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    method: "POST",
                    body: JSON.stringify(requestBody),
                });
                const { shortLink: shortUrl } = yield response.json();
                this.logs.shortenUrlComplete(shortUrl);
                yield this.updateShortUrl(snapshot, shortUrl);
            }
            catch (err) {
                this.logs.error(err.body);
            }
        });
    }
}
const urlShortener = new FirestoreDynamicLinksUrlShortener(config_1.default.urlFieldName, config_1.default.shortUrlFieldName, config_1.default.dynamicLinkUrlPrefix, config_1.default.dynamicLinkSuffixLength);
exports.shorten_create = functions.handler.firestore.document.onCreate((snapshot) => __awaiter(void 0, void 0, void 0, function* () {
    return urlShortener.onDocumentCreate(snapshot);
}));
exports.shorten_update = functions.handler.firestore.document.onUpdate((change) => __awaiter(void 0, void 0, void 0, function* () {
    return urlShortener.onDocumentUpdate(change);
}));
