import type { Expression } from "firebase-functions/params";
import { defineString, expr } from "firebase-functions/params";
import type { CounterConfig } from "./export-config";

type ConfigExpression<T extends string | number | boolean> = Expression<T>;

export interface ConfigExpressions {
  internalStatePath: ConfigExpression<string>;
  region: ConfigExpression<string>;
  schedule: ConfigExpression<string>;
}

const params = {
  internalStatePath: defineString("INTERNAL_STATE_PATH", {
    default: "_firebase_ext_/sharded_counter",
  }),
  scheduleFrequencyMinutes: defineString("SCHEDULE_FREQUENCY", {
    default: "1",
  }),
  region: defineString("LOCATION", { default: "us-central1" }),
};

export const CONFIG_EXPRESSIONS: ConfigExpressions = {
  internalStatePath: params.internalStatePath,
  region: params.region,
  schedule: expr`every ${params.scheduleFrequencyMinutes} minutes`,
};

export function configFromEnv(): CounterConfig {
  return {
    internalStatePath: params.internalStatePath.value(),
    scheduleFrequencyMinutes: Number(params.scheduleFrequencyMinutes.value()),
    region: params.region.value(),
  };
}
