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
import * as events from "./events";

enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

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

  public async onDocumentWrite(
    change: functions.Change<admin.firestore.DocumentSnapshot>
  ) {
    this.logs.start();

    if (this.urlFieldName === this.shortUrlFieldName) {
      this.logs.fieldNamesNotDifferent();
      return;
    }

    const changeType = this.getChangeType(change);

    switch (changeType) {
      case ChangeType.CREATE:
        await this.handleCreateDocument(change.after);
        break;
      case ChangeType.DELETE:
        this.handleDeleteDocument();
        break;
      case ChangeType.UPDATE:
        await this.handleUpdateDocument(change.before, change.after);
        break;
      default: {
        const err = new Error(`Invalid change type: ${changeType}`);
        await events.recordErrorEvent(err);
        throw err;
      }
    }

    this.logs.complete();
  }

  protected extractUrl(snapshot: admin.firestore.DocumentSnapshot) {
    return snapshot.get(this.urlFieldName);
  }

  private getChangeType(
    change: functions.Change<admin.firestore.DocumentSnapshot>
  ) {
    if (!change.after.exists) {
      return ChangeType.DELETE;
    }
    if (!change.before.exists) {
      return ChangeType.CREATE;
    }
    return ChangeType.UPDATE;
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

  private handleDeleteDocument() {
    this.logs.documentDeleted();
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

  protected abstract shortenUrl(
    snapshot: admin.firestore.DocumentSnapshot
  ): Promise<void>;

  protected async updateShortUrl(
    snapshot: admin.firestore.DocumentSnapshot,
    url: any
  ): Promise<void> {
    this.logs.updateDocument(snapshot.ref.path);

    // Wrapping in transaction to allow for automatic retries (#48)
    await admin.firestore().runTransaction((transaction) => {
      transaction.update(snapshot.ref, this.shortUrlFieldName, url);
      return Promise.resolve();
    });
    this.logs.updateDocumentComplete(snapshot.ref.path);
    await events.recordSuccessEvent({
      subject: snapshot.ref.path,
      data: { url },
    });
  }
}
