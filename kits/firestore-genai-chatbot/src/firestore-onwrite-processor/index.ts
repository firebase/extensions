/*
 * Copyright 2026 Google LLC
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

import type { DocumentSnapshot } from "firebase-admin/firestore";
import {
  ChangeType,
  type DocumentChange,
  type FirestoreField,
  getChangeType,
  now,
  type ProcessConfig,
  State,
} from "./common";

/**
 * Runs a processing function over a Firestore document write, writing a
 * `status` state-machine (`PROCESSING` → `COMPLETED`/`ERROR`) and the output
 * back onto the document. Idempotent: it skips documents already processing,
 * completed, errored, or whose input field did not change.
 */
export class FirestoreOnWriteProcessor<
  TInput,
  TOutput extends Record<string, FirestoreField>
> {
  inputField: string;
  processFn: (val: TInput, after: DocumentSnapshot) => Promise<TOutput>;
  statusField: string;
  processUpdates: boolean;
  orderField: string;
  errorFn: (e: unknown) => string;

  constructor(options: ProcessConfig<TInput, TOutput>) {
    this.inputField = options.inputField;
    this.orderField = options.orderField || "createTime";
    this.processFn = options.processFn;
    this.statusField = options.statusField || "status";
    this.processUpdates = true;
    this.errorFn = options.errorFn;
  }

  private shouldProcess(
    change: DocumentChange,
    changeType: ChangeType,
    state: State
  ): boolean {
    const newValue = this.getLatestInputValue(change);
    const oldValue = this.getPreviousInputValue(change);

    const hasChanged =
      changeType === ChangeType.CREATE ||
      (this.processUpdates &&
        changeType === ChangeType.UPDATE &&
        oldValue !== newValue);

    // TODO(migration): inherited verbatim from the legacy extension — a doc in
    // COMPLETED/ERROR state is always skipped, even if the prompt changed, so
    // editing a prompt never re-generates. Likely intentional dedup, but revisit
    // whether a changed input should re-process. Deferred from PR #431 review.
    if (
      !newValue ||
      [State.PROCESSING, State.COMPLETED, State.ERROR].includes(state) ||
      !hasChanged ||
      typeof newValue !== "string"
    ) {
      return false;
    }
    return true;
  }

  private getLatestInputValue(change: DocumentChange) {
    return change.after?.get(this.inputField);
  }

  private getPreviousInputValue(change: DocumentChange) {
    return change.before?.get(this.inputField);
  }

  private async writeStartEvent(change: DocumentChange) {
    const updateTime = now();
    const createTime = change.after.createTime;

    if (!createTime) {
      throw new Error("Missing document createTime for start event.");
    }

    const status = {
      state: State.PROCESSING,
      startTime: updateTime,
      updateTime,
    };

    const startData = change.after.get(this.orderField);
    const update = startData
      ? { [this.statusField]: status }
      : { [this.orderField]: createTime, [this.statusField]: status };

    await change.after.ref.update(update);
  }

  private async writeCompletionEvent(change: DocumentChange, output: TOutput) {
    const updateTime = now();
    const stateField = `${this.statusField}.state`;
    const updateTimeField = `${this.statusField}.updateTime`;
    const completeTimeField = `${this.statusField}.completeTime`;
    await change.after.ref.update({
      ...output,
      [stateField]: State.COMPLETED,
      [updateTimeField]: updateTime,
      [completeTimeField]: updateTime,
    });
  }

  private async writeErrorEvent(change: DocumentChange, e: unknown) {
    const eventTimestamp = now();
    const errorMessage = this.errorFn(e);
    await change.after.ref.update({
      [this.statusField]: {
        state: State.ERROR,
        updateTime: eventTimestamp,
        error: errorMessage,
      },
    });
  }

  async run(change: DocumentChange): Promise<void> {
    const changeType = getChangeType(change);
    if (changeType === ChangeType.DELETE) return;

    const state: State = change.after.get(this.statusField)?.state;

    if (!this.shouldProcess(change, changeType, state)) {
      return;
    }

    await this.writeStartEvent(change);

    try {
      const input = this.getLatestInputValue(change);
      const output = await this.processFn(input, change.after);
      await this.writeCompletionEvent(change, output);
    } catch (e) {
      await this.writeErrorEvent(change, e);
    }
  }
}
