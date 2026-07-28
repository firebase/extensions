export interface CounterConfig {
  internalStatePath: string;
  scheduleFrequencyMinutes: number;
  region?: string;
}

export interface ResolvedCounterConfig {
  internalStatePath: string;
  scheduleFrequencyMinutes: number;
  region: string;
}

const DEFAULT_REGION = "us-central1";

export function resolveCounterConfig(
  config: CounterConfig
): ResolvedCounterConfig {
  return {
    internalStatePath: config.internalStatePath,
    scheduleFrequencyMinutes: config.scheduleFrequencyMinutes,
    region: config.region ?? DEFAULT_REGION,
  };
}

export function scheduleExpression(config: ResolvedCounterConfig): string {
  return `every ${config.scheduleFrequencyMinutes} minutes`;
}
