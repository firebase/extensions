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

import PQueue from "p-queue";
import { describe, expect, test, vi } from "vitest";

import { GLOBAL_RETRY_QUEUE } from "../src/global";

describe("retry queue", () => {
  test("processes tasks in order of priority", async () => {
    const queue = new PQueue({ concurrency: 1, autoStart: false });
    const executionOrder: number[] = [];
    const task = (id: number) =>
      vi.fn(async () => {
        executionOrder.push(id);
        return `result${id}`;
      });
    const [task1, task2, task3] = [task(1), task(2), task(3)];

    const promises = [
      queue.add(task2, { priority: 2 }),
      queue.add(task3, { priority: 1 }),
      queue.add(task1, { priority: 3 }),
    ];

    queue.start();
    await Promise.all(promises);

    expect(executionOrder).toEqual([1, 2, 3]);
    expect(task1).toHaveBeenCalledTimes(1);
    expect(task2).toHaveBeenCalledTimes(1);
    expect(task3).toHaveBeenCalledTimes(1);
  });

  test("handles task failures correctly", async () => {
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

  test("respects the concurrency limit", async () => {
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

    const promises = Array.from({ length: 10 }, (_, i) =>
      queue.add(createTask(10), { priority: i + 1 })
    );

    queue.start();
    await Promise.all(promises);

    expect(maxConcurrentCount).toBeLessThanOrEqual(3);
  });

  test("continues processing the queue after a task completes", async () => {
    const queue = new PQueue({ concurrency: 1, autoStart: false });
    const executionOrder: number[] = [];
    const slowTask = async () => {
      executionOrder.push(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "slow done";
    };
    const fastTask = (id: number) => async () => {
      executionOrder.push(id);
      return `fast${id} done`;
    };

    const promises = [
      queue.add(slowTask, { priority: 3 }),
      queue.add(fastTask(2), { priority: 2 }),
      queue.add(fastTask(3), { priority: 1 }),
    ];

    queue.start();
    await Promise.all(promises);

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  test("handles an empty queue gracefully", () => {
    const queue = new PQueue({ concurrency: 3 });

    expect(() => queue.start()).not.toThrow();
  });

  test("runs tasks of equal priority in the order they were added", async () => {
    const queue = new PQueue({ concurrency: 1, autoStart: false });
    const executionOrder: number[] = [];

    const promises = Array.from({ length: 5 }, (_, i) =>
      queue.add(
        async () => {
          executionOrder.push(i + 1);
          return `result${i + 1}`;
        },
        { priority: 1 }
      )
    );

    queue.start();
    await Promise.all(promises);

    expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
  });

  test("handles a large number of tasks", async () => {
    const queue = new PQueue({ concurrency: 3, autoStart: false });
    const taskCount = 50;
    const completedTasks: number[] = [];

    const promises = Array.from({ length: taskCount }, (_, i) =>
      queue.add(
        async () => {
          completedTasks.push(i);
          return i;
        },
        { priority: i }
      )
    );

    queue.start();
    await Promise.all(promises);

    expect(completedTasks).toHaveLength(taskCount);
  });

  test("the shared content-filter queue caps concurrency at three", () => {
    expect(GLOBAL_RETRY_QUEUE.concurrency).toBe(3);
  });
});
