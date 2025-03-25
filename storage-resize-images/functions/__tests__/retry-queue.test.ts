import { RetryQueue } from "../src/retry-queue";

describe("RetryQueue", () => {
  let queue: RetryQueue;

  beforeEach(() => {
    queue = new RetryQueue();
    jest.useRealTimers();
  });

  test("should process tasks in order of priority", async () => {
    jest.useFakeTimers();
    let executionOrder: number[] = [];

    // Force sequential execution by overriding concurrency limit
    // @ts-ignore - accessing private property for testing
    queue["concurrencyLimit"] = 1;

    // Create three tasks with different priorities
    const task1 = jest.fn().mockImplementation(async () => {
      executionOrder.push(1);
      return "result1";
    });

    const task2 = jest.fn().mockImplementation(async () => {
      executionOrder.push(2);
      return "result2";
    });

    const task3 = jest.fn().mockImplementation(async () => {
      executionOrder.push(3);
      return "result3";
    });

    // Set up promises to track task completion
    const promise2 = queue.enqueue(task2, 2);
    const promise3 = queue.enqueue(task3, 3);
    const promise1 = queue.enqueue(task1, 1);

    // Advance timers to allow the sorting to complete
    jest.advanceTimersByTime(10);

    // Run all pending promises
    await Promise.resolve();

    // Fast-forward to complete all queued tasks
    jest.runAllTimers();

    // Wait for all task promises to resolve
    await Promise.all([promise1, promise2, promise3]);

    // Verify that tasks were executed in priority order (1, 2, 3)
    expect(executionOrder).toEqual([1, 2, 3]);

    // Verify all tasks were executed
    expect(task1).toHaveBeenCalledTimes(1);
    expect(task2).toHaveBeenCalledTimes(1);
    expect(task3).toHaveBeenCalledTimes(1);
  });

  test("should handle task failures correctly", async () => {
    const successTask = jest.fn().mockResolvedValue("success");
    const failureTask = jest.fn().mockRejectedValue(new Error("Task failed"));

    const successPromise = queue.enqueue(successTask, 1);
    const failurePromise = queue.enqueue(failureTask, 2);

    // Success task should resolve
    await expect(successPromise).resolves.toBe("success");

    // Failure task should reject
    await expect(failurePromise).rejects.toThrow("Task failed");

    expect(successTask).toHaveBeenCalledTimes(1);
    expect(failureTask).toHaveBeenCalledTimes(1);
  });

  test("should respect concurrency limit", async () => {
    // Create a mock implementation to track concurrent execution
    let concurrentCount = 0;
    let maxConcurrentCount = 0;

    // Create tasks that track concurrency
    const createTask = (delay: number) => {
      return async () => {
        concurrentCount++;
        maxConcurrentCount = Math.max(maxConcurrentCount, concurrentCount);

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, delay));

        concurrentCount--;
        return delay;
      };
    };

    // Queue multiple slow tasks
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(queue.enqueue(createTask(10), (i % 3) + 1)); // Vary priority
    }

    // Wait for all tasks to complete
    await Promise.all(promises);

    // The RetryQueue has a concurrency limit of 3 (private property),
    // so maxConcurrentCount should never exceed 3
    expect(maxConcurrentCount).toBeLessThanOrEqual(3);
  });

  test("should continue processing queue after task completion", async () => {
    jest.useFakeTimers();
    // Force sequential execution
    // @ts-ignore - accessing private property for testing
    queue["concurrencyLimit"] = 1;

    const executionOrder: number[] = [];

    // Task that takes some time to complete
    const slowTask = async () => {
      executionOrder.push(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "slow done";
    };

    // Fast tasks that should execute after the slow one completes
    const fastTask1 = async () => {
      executionOrder.push(2);
      return "fast1 done";
    };

    const fastTask2 = async () => {
      executionOrder.push(3);
      return "fast2 done";
    };

    // Enqueue tasks
    const promise1 = queue.enqueue(slowTask, 1); // Higher priority
    const promise2 = queue.enqueue(fastTask1, 2);
    const promise3 = queue.enqueue(fastTask2, 3);

    // Advance timers to allow sorting to complete
    jest.advanceTimersByTime(10);

    // Run all pending promises
    await Promise.resolve();

    // Fast-forward time to allow tasks to complete
    jest.runAllTimers();

    // Wait for all tasks to complete
    await Promise.all([promise1, promise2, promise3]);

    // Check tasks were executed in priority order
    expect(executionOrder).toEqual([1, 2, 3]);
  });

  test("should handle empty queue gracefully", async () => {
    // Just make sure no errors are thrown
    expect(() => {
      // @ts-ignore - accessing private method for testing
      queue.processQueue();
    }).not.toThrow();
  });

  test("should handle many tasks with same priority in order of addition", async () => {
    jest.useFakeTimers();
    // Force sequential execution
    // @ts-ignore - accessing private property for testing
    queue["concurrencyLimit"] = 1;

    const executionOrder: number[] = [];

    // Create multiple tasks with the same priority
    const createNumberedTask = (num: number) => {
      return async () => {
        executionOrder.push(num);
        return `result${num}`;
      };
    };

    // Queue tasks with same priority
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(queue.enqueue(createNumberedTask(i), 1)); // All same priority
    }

    // Advance timers to allow sorting to complete
    jest.advanceTimersByTime(10);

    // Run all pending promises
    await Promise.resolve();

    // Fast-forward time to allow tasks to complete
    jest.runAllTimers();

    // Wait for all tasks to complete
    await Promise.all(promises);

    // Tasks with the same priority should be executed in the order they were added
    expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
  });

  test("should handle large number of tasks efficiently", async () => {
    const taskCount = 50; // Reduced for faster test execution
    const completedTasks: number[] = [];

    // Create many tasks
    const promises = [];
    for (let i = 0; i < taskCount; i++) {
      promises.push(
        queue.enqueue(async () => {
          completedTasks.push(i);
          return i;
        }, i % 10) // Cycle through 10 priority levels
      );
    }

    // Wait for all tasks to complete
    await Promise.all(promises);

    // All tasks should have been completed
    expect(completedTasks.length).toBe(taskCount);
  });
});
