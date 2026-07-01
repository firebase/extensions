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

import { initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  DocumentSnapshot,
  FieldValue,
} from "firebase-admin/firestore";
import { Change } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

import * as logs from "./logs";
import * as events from "./events";
import config from "./config";

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
    initializeApp();
  }

  public async onDocumentWrite(change: Change<DocumentSnapshot>) {
    this.logs.start();

    if (this.urlFieldName === this.shortUrlFieldName) {
      this.logs.fieldNamesNotDifferent();
      return;
    }

    const changeType = this.getChangeType(change);

    try {
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
    } catch (err) {
      logger.error("Error in extension execution", err);
      await events.recordErrorEvent(
        err instanceof Error ? err : new Error(String(err))
      );
      throw err;
    }
  }

  protected extractUrl(snapshot: DocumentSnapshot) {
    const data = snapshot.data();
    return data ? data[this.urlFieldName] : undefined;
  }

  private getChangeType(change: Change<DocumentSnapshot>) {
    if (!change.after.exists) {
      return ChangeType.DELETE;
    }
    if (!change.before.exists) {
      return ChangeType.CREATE;
    }
    return ChangeType.UPDATE;
  }

  private async handleCreateDocument(snapshot: DocumentSnapshot) {
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
    before: DocumentSnapshot,
    after: DocumentSnapshot
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
      await this.updateShortUrl(after, FieldValue.delete());
    } else {
      this.logs.documentUpdatedNoUrl();
    }
  }

  protected abstract shortenUrl(snapshot: DocumentSnapshot): Promise<void>;

  protected async updateShortUrl(
    snapshot: DocumentSnapshot,
    url: any
  ): Promise<void> {
    this.logs.updateDocument(snapshot.ref.path);

    // Wrapping in transaction to allow for automatic retries
    const firestore = getFirestore(config.database);
    await firestore.runTransaction((transaction) => {
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
