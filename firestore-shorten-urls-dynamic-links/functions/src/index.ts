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

import { URLSearchParams } from "url";

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as got from "got";

import { FirestoreUrlShortener } from "./abstract-shortener"
import config from "./config";
import * as logs from "./logs";

class ServiceAccountCredential {
  private readonly metadataServiceUri = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  private readonly requiredScopes = "https://www.googleapis.com/auth/firebase";

  private accessToken: string | undefined;
  private tokenExpiration: number | undefined;

  public async getAccessToken() {
    const now = Math.floor(Date.now() / 1000)
    const nowish = now + 30;  // 30s leeway

    if (typeof this.accessToken === "undefined"
        || typeof this.tokenExpiration === "undefined"
        || this.tokenExpiration < nowish) {
      const metadataResponse = await got(this.metadataServiceUri, {
        query: new URLSearchParams({scopes: this.requiredScopes}),
        headers: {
          "Metadata-Flavor": "Google"
        },
        json: true
      });
      const { access_token, expires_in } = metadataResponse.body;
      this.accessToken = access_token;
      this.tokenExpiration = now + expires_in;
    }

    return this.accessToken;
  }
}

class FirestoreDynamicLinksUrlShortener extends FirestoreUrlShortener {

  private readonly dynamicLinksApiUrl = "https://firebasedynamiclinks.googleapis.com/v1/shortLinks";
  private credentials = new ServiceAccountCredential();

  constructor(
    urlFieldName: string,
    shortUrlFieldName: string,
    private dynamicLinkUrlPrefix: string,
    private dynamicLinkSuffixLength: string
  ) {
    super(urlFieldName, shortUrlFieldName);
    this.logs = logs;
    this.logs.init();
  }

  protected async shortenUrl(
    snapshot: admin.firestore.DocumentSnapshot
  ): Promise<void> {
    const url = this.extractUrl(snapshot);
    this.logs.shortenUrl(url);

    const accessToken = await this.credentials.getAccessToken();
  
    try {
      const requestBody = {
        dynamicLinkInfo: {
          domainUriPrefix: this.dynamicLinkUrlPrefix,
          link: url,
        },
        suffix: {option: this.dynamicLinkSuffixLength}
      };
      const response = await got(this.dynamicLinksApiUrl, {
        headers: {
          "Authorization": `Bearer ${accessToken}`
        },
        method: 'POST',
        json: true,
        body: requestBody
      });
      const { shortLink: shortUrl } = response.body;      

      this.logs.shortenUrlComplete(shortUrl);
  
      await this.updateShortUrl(snapshot, shortUrl);
    } catch (err) {
      this.logs.error(err.body);
    }
  } 
}

const urlShortener = new FirestoreDynamicLinksUrlShortener(
  config.urlFieldName,
  config.shortUrlFieldName,
  config.dynamicLinkUrlPrefix,
  config.dynamicLinkSuffixLength
);

export const fsurlshortener = functions.handler.firestore.document.onWrite(async (change) => {
  return urlShortener.onDocumentWrite(change);
});
