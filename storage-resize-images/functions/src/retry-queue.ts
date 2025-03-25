/**
 * A priority queue implementation for managing retries.
 * Tasks are processed in priority order with concurrency control.
 */
export class RetryQueue {
  private queue: Array<{
    priority: number;
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private isProcessing = false;
  private concurrencyLimit = 3; // Configurable
  private activeCount = 0;
  private pendingSort = false;

  /**
   * Add a task to the queue with priority (lower number = higher priority)
   * @param task The task function to execute
   * @param priority Priority value (lower = higher priority)
   * @returns Promise that resolves with the task result
   */
  public enqueue(
    task: () => Promise<any>,
    priority: number = 10
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Add the task to the queue
      this.queue.push({ task, priority, resolve, reject });

      // Sort the queue by priority
      this.sortQueue();

      // Start processing if not already
      this.processQueue();
    });
  }

  /**
   * Sort the queue by priority
   * This ensures tasks are always processed in priority order
   */
  private sortQueue(): void {
    if (this.pendingSort) return;

    this.pendingSort = true;

    // Use setTimeout to ensure sorting happens after all current tasks are queued
    setTimeout(() => {
      this.queue.sort((a, b) => a.priority - b.priority);
      this.pendingSort = false;

      // After sorting, ensure processing continues
      this.processQueue();
    }, 0);
  }

  /**
   * Process the queue, respecting concurrency limits
   */
  private async processQueue() {
    // If already processing or a sort is pending, return to avoid race conditions
    if (this.isProcessing || this.pendingSort) return;

    this.isProcessing = true;

    while (this.queue.length > 0 && this.activeCount < this.concurrencyLimit) {
      this.activeCount++;
      // Always take the first item, which should be the highest priority after sorting
      const { task, resolve, reject } = this.queue.shift()!;

      // Execute the task
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.activeCount--;
      }

      // If a sort is pending, break the loop and let the sort complete first
      if (this.pendingSort) break;
    }

    this.isProcessing = false;

    // If there are still items and we have capacity, continue processing
    // But only if no sort is pending
    if (
      this.queue.length > 0 &&
      this.activeCount < this.concurrencyLimit &&
      !this.pendingSort
    ) {
      this.processQueue();
    }
  }
}

// Global singleton instance
export const globalRetryQueue = new RetryQueue();
