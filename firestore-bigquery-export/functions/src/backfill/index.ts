import * as functions from "firebase-functions";
import { backfillTaskHandler } from "./backfillTaskHandler";
import { backfillTriggerHandler } from "./backfillTriggerHandler";

// TODO we should create an index on __name__ field
export const backfillTrigger = functions.tasks
  .taskQueue()
  .onDispatch(backfillTriggerHandler);

export const backfillHandler = functions.tasks
  .taskQueue()
  .onDispatch(backfillTaskHandler);
