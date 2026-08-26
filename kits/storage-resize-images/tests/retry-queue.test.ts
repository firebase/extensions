/**
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

/**
 * Parity with the extension's `__tests__/retry-queue.test.ts` — the p-queue
 * semantics the content filter's retry path depends on — plus an assertion
 * that the shipped `GLOBAL_RETRY_QUEUE` is configured the way those semantics
 * assume.
 */

import PQueue from "p-queue";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GLOBAL_RETRY_QUEUE } from "../src/global";

describe("GLOBAL_RETRY_QUEUE", () => {
  test("is a started queue with a concurrency of 3", () => {
    expect(GLOBAL_RETRY_QUEUE.concurrency).toBe(3);
    expect(GLOBAL_RETRY_QUEUE.isPaused).toBe(false);
  });

  test("runs an added task and returns its value", async () => {
    await expect(
      GLOBAL_RETRY_QUEUE.add(async () => "done", { priority: -1 })
    ).resolves.toBe("done");
  });
});

describe("RetryQueue", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should process tasks in order of priority", async () => {
    // Force sequential execution by overriding concurrency limit
    const queue = new PQueue({ concurrency: 1, autoStart: false });

    const executionOrder: number[] = [];

    const task1 = vi.fn().mockImplementation(async () => {
      executionOrder.push(1);
      return "result1";
    });

    const task2 = vi.fn().mockImplementation(async () => {
      executionOrder.push(2);
      return "result2";
    });

    const task3 = vi.fn().mockImplementation(async () => {
      executionOrder.push(3);
      return "result3";
    });

    const promise1 = queue.add(task2, { priority: 2 });
    const promise2 = queue.add(task3, { priority: 1 });
    const promise3 = queue.add(task1, { priority: 3 });

    queue.start();

    await Promise.all([promise1, promise2, promise3]);

    // Highest priority first.
    expect(executionOrder).toEqual([1, 2, 3]);

    expect(task1).toHaveBeenCalledTimes(1);
    expect(task2).toHaveBeenCalledTimes(1);
    expect(task3).toHaveBeenCalledTimes(1);
  });

  test("should handle task failures correctly", async () => {
    const queue = new PQueue({ concurrency: 3, autoStart: false });

    const successTask = vi.fn().mockResolvedValue("success");
    const failureTask = vi.fn().mockRejectedValue(new Error("Task failed"));

    const successPromise = queue.add(successTask, { priority: 2 });
    const failurePromise = queue.add(failureTask, { priority: 1 });

    queue.start();

    await expect(successPromise).resolves.toBe("success");
    await expect(failurePromise).rejects.toThrow("Task failed");

    expect(successTask).toHaveBeenCalledTimes(1);
    expect(failureTask).toHaveBeenCalledTimes(1);
  });

  test("should respect concurrency limit", async () => {
    const queue = new PQueue({ concurrency: 3, autoStart: false });

    let concurrentCount = 0;
    let maxConcurrentCount = 0;

    const createTask = (delay: number) => async () => {
      concurrentCount++;
      maxConcurrentCount = Math.max(maxConcurrentCount, concurrentCount);

      await new Promise((resolve) => setTimeout(resolve, delay));

      concurrentCount--;
      return delay;
    };

    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(queue.add(createTask(10), { priority: i + 1 }));
    }

    queue.start();

    await Promise.all(promises);

    // Matches GLOBAL_RETRY_QUEUE's concurrency of 3.
    expect(maxConcurrentCount).toBeLessThanOrEqual(3);
  });

  test("should continue processing queue after task completion", async () => {
    const queue = new PQueue({ concurrency: 1, autoStart: false });

    const executionOrder: number[] = [];

    const slowTask = async () => {
      executionOrder.push(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "slow done";
    };

    const fastTask1 = async () => {
      executionOrder.push(2);
      return "fast1 done";
    };

    const fastTask2 = async () => {
      executionOrder.push(3);
      return "fast2 done";
    };

    const promise1 = queue.add(slowTask, { priority: 3 });
    const promise2 = queue.add(fastTask1, { priority: 2 });
    const promise3 = queue.add(fastTask2, { priority: 1 });

    queue.start();

    await Promise.all([promise1, promise2, promise3]);

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  test("should handle empty queue gracefully", () => {
    const queue = new PQueue({ concurrency: 3 });
    expect(() => queue.start()).not.toThrow();
  });

  test("should handle many tasks with same priority in order of addition", async () => {
    const queue = new PQueue({ concurrency: 1, autoStart: false });

    const executionOrder: number[] = [];

    const createNumberedTask = (num: number) => async () => {
      executionOrder.push(num);
      return `result${num}`;
    };

    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(queue.add(createNumberedTask(i), { priority: 1 }));
    }

    queue.start();

    await Promise.all(promises);

    expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
  });

  test("should handle large number of tasks efficiently", async () => {
    const queue = new PQueue({ concurrency: 3, autoStart: false });

    const taskCount = 50;
    const completedTasks: number[] = [];

    const promises = [];
    for (let i = 0; i < taskCount; i++) {
      promises.push(
        queue.add(
          async () => {
            completedTasks.push(i);
            return i;
          },
          { priority: i }
        )
      );
    }

    queue.start();

    await Promise.all(promises);

    expect(completedTasks.length).toBe(taskCount);
  });

  test("later retry attempts queue behind earlier ones", async () => {
    // The content filter enqueues retries with `priority: -attemptNumber`,
    // so attempt 2 must run before attempt 3 when both are waiting.
    const queue = new PQueue({ concurrency: 1, autoStart: false });
    const order: number[] = [];

    const attempt3 = queue.add(
      async () => {
        order.push(3);
      },
      { priority: -3 }
    );
    const attempt2 = queue.add(
      async () => {
        order.push(2);
      },
      { priority: -2 }
    );

    queue.start();
    await Promise.all([attempt2, attempt3]);

    expect(order).toEqual([2, 3]);
  });
});
