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
import axios, { AxiosInstance } from "axios";

import { FirestoreUrlShortener } from "./abstract-shortener";
import config from "./config";
import * as logs from "./logs";

class FirestoreBitlyUrlShortener extends FirestoreUrlShortener {
  private instance: AxiosInstance;

  constructor(
    urlFieldName: string,
    shortUrlFieldName: string,
    bitlyAccessToken: string
  ) {
    super(urlFieldName, shortUrlFieldName);
    this.instance = axios.create({
      headers: {
        Authorization: `Bearer ${bitlyAccessToken}`,
        "Content-Type": "application/json",
      },
      baseURL: "https://api-ssl.bitly.com/v4/",
    });

    logs.init();
  }

  protected async shortenUrl(
    snapshot: admin.firestore.DocumentSnapshot
  ): Promise<void> {
    const url = this.extractUrl(snapshot);
    logs.shortenUrl(url);

    try {
      const response: any = await this.instance.post("bitlinks", {
        long_url: url,
      });

      const { link } = response.data;

      logs.shortenUrlComplete(link);

      await this.updateShortUrl(snapshot, link);
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

export const fsurlshortener = functions.handler.firestore.document.onWrite(
  async (change) => {
    return urlShortener.onDocumentWrite(change);
  }
);
