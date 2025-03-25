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
import { DocumentSnapshot } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

import { FirestoreUrlShortener } from "./abstract-shortener";
import config from "./config";
import * as logs from "./logs";
import * as events from "./events";

interface BitlyResponse {
  link?: string;
}

class FirestoreBitlyUrlShortener extends FirestoreUrlShortener {
  private bitlyAccessToken: string;

  constructor(
    urlFieldName: string,
    shortUrlFieldName: string,
    bitlyAccessToken: string
  ) {
    super(urlFieldName, shortUrlFieldName);
    this.bitlyAccessToken = bitlyAccessToken;
    logs.init();
  }

  protected async shortenUrl(snapshot: DocumentSnapshot): Promise<void> {
    const url = this.extractUrl(snapshot);
    logs.shortenUrl(url);

    try {
      const response = await fetch("https://api-ssl.bitly.com/v4/bitlinks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.bitlyAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ long_url: url }),
      });

      if (!response.ok) {
        throw new Error(`Error shortening URL: ${response.statusText}`);
      }

      const data: BitlyResponse = await response.json();

      if (data.link) {
        logs.shortenUrlComplete(data.link);
        await this.updateShortUrl(snapshot, data.link);
      } else {
        throw new Error("Bitly response did not contain a link.");
      }
    } catch (err) {
      logs.error(err);
    }
  }
}

const urlShortener = new FirestoreBitlyUrlShortener(
  config.urlFieldName,
  config.shortUrlFieldName,
  config.bitlyAccessToken
);

events.setupEventChannel();

export const fsurlshortener = onDocumentWritten(
  `${config.collectionPath}/{documentId}`,
  async (event) => {
    const { data, ...context } = event;

    await events.recordStartEvent({ context, change: data });
    await urlShortener.onDocumentWrite(data);
    await events.recordCompletionEvent({ context });
  }
);
