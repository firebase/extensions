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

import { URL, URLSearchParams } from "url";

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import fetch from "node-fetch";

import { FirestoreUrlShortener } from "./abstract-shortener";
import config from "./config";
import * as logs from "./logs";

class ServiceAccountCredential {
  private readonly metadataServiceUri = new URL(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
  );
  private readonly requiredScopes = "https://www.googleapis.com/auth/firebase";

  private accessToken: string | undefined;
  private tokenExpiration: number | undefined;

  constructor() {
    const searchParams = new URLSearchParams({ scopes: this.requiredScopes });
    this.metadataServiceUri.search = searchParams.toString();
  }

  public async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const nowish = now + 30; // 30s leeway

    if (
      typeof this.accessToken === "undefined" ||
      typeof this.tokenExpiration === "undefined" ||
      this.tokenExpiration < nowish
    ) {
      const metadataResponse = await fetch(this.metadataServiceUri, {
        headers: {
          "Metadata-Flavor": "Google",
        },
      });
      const { access_token, expires_in } = await metadataResponse.json();
      this.accessToken = access_token;
      this.tokenExpiration = now + expires_in;
    }

    return this.accessToken;
  }
}

class FirestoreDynamicLinksUrlShortener extends FirestoreUrlShortener {
  private readonly dynamicLinksApiUrl =
    "https://firebasedynamiclinks.googleapis.com/v1/shortLinks";
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
        suffix: { option: this.dynamicLinkSuffixLength },
      };
      const response = await fetch(this.dynamicLinksApiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
        body: JSON.stringify(requestBody),
      });
      const { shortLink: shortUrl } = await response.json();

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

export const shorten_create = functions.handler.firestore.document.onCreate(
  async (snapshot) => {
    return urlShortener.onDocumentCreate(snapshot);
  }
);

export const shorten_update = functions.handler.firestore.document.onUpdate(
  async (change) => {
    return urlShortener.onDocumentUpdate(change);
  }
);
