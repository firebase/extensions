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

import * as logs from "./logs";

export abstract class FirestoreUrlShortener {
  protected logs = logs;

  constructor(
    protected urlFieldName: string,
    protected shortUrlFieldName: string
  ) {
    this.urlFieldName = urlFieldName;
    this.shortUrlFieldName = shortUrlFieldName;

    // Initialize the Firebase Admin SDK
    admin.initializeApp();
  }

  public async onDocumentCreate(snapshot: admin.firestore.DocumentSnapshot) {
    this.logs.start();

    if (this.urlFieldName === this.shortUrlFieldName) {
      this.logs.fieldNamesNotDifferent();
      return;
    }

    await this.handleCreateDocument(snapshot);

    this.logs.complete();
  }

  public async onDocumentUpdate(
    change: functions.Change<admin.firestore.DocumentSnapshot>
  ) {
    this.logs.start();

    if (this.urlFieldName === this.shortUrlFieldName) {
      this.logs.fieldNamesNotDifferent();
      return;
    }

    await this.handleUpdateDocument(change.before, change.after);

    this.logs.complete();
  }

  protected extractUrl(snapshot: admin.firestore.DocumentSnapshot) {
    return snapshot.get(this.urlFieldName);
  }

  private async handleCreateDocument(
    snapshot: admin.firestore.DocumentSnapshot
  ) {
    const url = this.extractUrl(snapshot);
    if (url) {
      this.logs.documentCreatedWithUrl();
      await this.shortenUrl(snapshot);
    } else {
      this.logs.documentCreatedNoUrl();
    }
  }

  private async handleUpdateDocument(
    before: admin.firestore.DocumentSnapshot,
    after: admin.firestore.DocumentSnapshot
  ) {
    const urlAfter = this.extractUrl(after);
    const urlBefore = this.extractUrl(before);

    if (urlAfter === urlBefore) {
      this.logs.documentUpdatedUnchangedUrl();
    } else if (urlAfter) {
      this.logs.documentUpdatedChangedUrl();
      await this.shortenUrl(after);
    } else if (urlBefore) {
      this.logs.documentUpdatedDeletedUrl();
      await this.updateShortUrl(after, admin.firestore.FieldValue.delete());
    } else {
      this.logs.documentUpdatedNoUrl();
    }
  }

  protected abstract async shortenUrl(
    snapshot: admin.firestore.DocumentSnapshot
  ): Promise<void>;

  protected async updateShortUrl(
    snapshot: admin.firestore.DocumentSnapshot,
    url: any
  ): Promise<void> {
    this.logs.updateDocument(snapshot.ref.path);

    await snapshot.ref.update(this.shortUrlFieldName, url);

    this.logs.updateDocumentComplete(snapshot.ref.path);
  }
}
