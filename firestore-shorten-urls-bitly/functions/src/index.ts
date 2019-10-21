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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { BitlyClient } from "bitly";

import { FirestoreUrlShortener } from "./abstract-shortener";
import config from "./config";
import * as logs from "./logs";

class FirestoreBitlyUrlShortener extends FirestoreUrlShortener {

  private bitly: BitlyClient;

  constructor(
    urlFieldName: string,
    shortUrlFieldName: string,
    bitlyAccessToken: string
  ) {
    super(urlFieldName, shortUrlFieldName);
    this.bitly = new BitlyClient(bitlyAccessToken);
    logs.init();
  }

  protected async shortenUrl(
    snapshot: admin.firestore.DocumentSnapshot
  ): Promise<void> {
    const url = this.extractUrl(snapshot);
    logs.shortenUrl(url);
  
    try {
      const response: any = await this.bitly.shorten(url);
      const { url: shortUrl } = response;

      logs.shortenUrlComplete(shortUrl);
  
      await this.updateShortUrl(snapshot, shortUrl);
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

export const fsurlshortener = functions.handler.firestore.document.onWrite(async (change) => {
  return urlShortener.onDocumentWrite(change);
});
