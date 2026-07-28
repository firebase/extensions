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

import type { ResolvedRtdbLimitConfig } from "./export-config";
import * as logs from "./logs";

export interface ChildSnapshotLike {
  key: string | null;
}

export interface ParentSnapshotLike {
  numChildren(): number;
  forEach(action: (child: ChildSnapshotLike) => unknown): boolean;
}

export interface ParentRefLike {
  once(eventType: "value"): Promise<ParentSnapshotLike>;
  update(values: Record<string, null>): Promise<void>;
}

export interface DatabaseRefLike {
  parent: ParentRefLike | null;
  root: { toString(): string };
  toString(): string;
}

export interface DatabaseSnapshotLike {
  ref: DatabaseRefLike;
}

export interface ChildCreatedEvent {
  data?: DatabaseSnapshotLike;
}

export interface HandlerContext {
  config: ResolvedRtdbLimitConfig;
}

function toReferencePath(ref: DatabaseRefLike): string {
  return ref.toString().substring(ref.root.toString().length - 1);
}

export async function handleChildCreated(
  event: ChildCreatedEvent,
  ctx: HandlerContext
): Promise<void> {
  logs.start(ctx.config);

  try {
    const childRef = event.data?.ref;
    const parentRef = childRef?.parent;

    if (!childRef || !parentRef) {
      logs.complete();
      return;
    }

    const parentSnapshot = await parentRef.once("value");
    const reference = toReferencePath(childRef);
    const totalChildren = parentSnapshot.numChildren();

    logs.childCount(reference, totalChildren);

    if (totalChildren > ctx.config.maxCount) {
      const updates: Record<string, null> = {};
      const trimCount = totalChildren - ctx.config.maxCount;
      let childCount = 0;

      parentSnapshot.forEach((child) => {
        childCount += 1;
        if (childCount <= trimCount && child.key) {
          updates[child.key] = null;
        }
      });

      logs.pathTruncating(reference, ctx.config.maxCount);
      await parentRef.update(updates);
      logs.pathTruncated(reference, ctx.config.maxCount);
    } else {
      logs.pathSkipped(reference);
    }

    logs.complete();
  } catch (err) {
    logs.error(err as Error);
  }
}
