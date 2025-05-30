import { Ok, Err, type Result } from "../types/ts-results";

/**
 * Error type for concurrency operations
 */
type ConcurrencyError = {
  message: string;
  cause?: unknown;
};

/**
 * Semaphore for controlling concurrent operations
 */
export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquire a permit (blocks if none available)
   */
  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  /**
   * Release a permit
   */
  release(): void {
    this.permits++;

    if (this.waiting.length > 0) {
      const nextResolve = this.waiting.shift();
      if (nextResolve) {
        this.permits--;
        nextResolve();
      }
    }
  }

  /**
   * Get number of available permits
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * Get number of waiting tasks
   */
  waitingCount(): number {
    return this.waiting.length;
  }
}

/**
 * Task execution result
 */
type TaskResult<T> = {
  readonly success: boolean;
  readonly result?: T;
  readonly error?: unknown;
  readonly duration: number;
};

/**
 * Concurrency controller for managing parallel task execution
 */
export class ConcurrencyController<T> {
  private readonly semaphore: Semaphore;
  private readonly runningTasks: Set<Promise<TaskResult<T>>> = new Set();
  private stopped: boolean = false;

  constructor(maxConcurrency: number) {
    this.semaphore = new Semaphore(maxConcurrency);
  }

  /**
   * Execute a task with concurrency control
   */
  async executeTask<R>(
    taskId: string,
    task: () => Promise<R>
  ): Promise<Result<R, ConcurrencyError>> {
    if (this.stopped) {
      return Err({
        message: "Concurrency controller has been stopped",
      });
    }

    try {
      await this.semaphore.acquire();

      if (this.stopped) {
        this.semaphore.release();
        return Err({
          message: "Concurrency controller was stopped during task execution",
        });
      }

      try {
        const result = await task();
        return Ok(result);
      } finally {
        this.semaphore.release();
      }
    } catch (error) {
      this.semaphore.release();
      return Err({
        message: `Task ${taskId} failed`,
        cause: error,
      });
    }
  }

  /**
   * Execute multiple tasks concurrently
   */
  async executeTasks<R>(
    tasks: Array<{ id: string; task: () => Promise<R> }>
  ): Promise<Result<Array<Result<R, ConcurrencyError>>, ConcurrencyError>> {
    try {
      const taskPromises = tasks.map(({ id, task }) => this.executeTask(id, task));

      const results = await Promise.all(taskPromises);
      return Ok(results);
    } catch (error) {
      return Err({
        message: "Failed to execute tasks concurrently",
        cause: error,
      });
    }
  }

  /**
   * Execute tasks with retry logic
   */
  async executeTaskWithRetry<R>(
    taskId: string,
    task: () => Promise<R>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<Result<R, ConcurrencyError>> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.stopped) {
        return Err({
          message: "Concurrency controller has been stopped",
        });
      }

      const result = await this.executeTask(taskId, task);

      if (result.ok) {
        return result;
      }

      lastError = result.val.cause;

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    return Err({
      message: `Task ${taskId} failed after ${maxRetries + 1} attempts`,
      cause: lastError,
    });
  }

  /**
   * Stop the concurrency controller
   */
  stop(): void {
    this.stopped = true;
  }

  /**
   * Check if the controller is stopped
   */
  isStopped(): boolean {
    return this.stopped;
  }

  /**
   * Get current statistics
   */
  getStats(): {
    availablePermits: number;
    waitingTasks: number;
    runningTasks: number;
    isStopped: boolean;
  } {
    return {
      availablePermits: this.semaphore.availablePermits(),
      waitingTasks: this.semaphore.waitingCount(),
      runningTasks: this.runningTasks.size,
      isStopped: this.stopped,
    };
  }

  /**
   * Wait for all running tasks to complete
   */
  async waitForCompletion(): Promise<void> {
    while (this.semaphore.waitingCount() > 0 || this.runningTasks.size > 0) {
      await this.delay(100);
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Task queue for ordered execution with concurrency limits
 */
export class TaskQueue<T> {
  private readonly controller: ConcurrencyController<T>;
  private readonly queue: Array<{
    id: string;
    task: () => Promise<T>;
    resolve: (_result: Result<T, ConcurrencyError>) => void;
  }> = [];
  private processing: boolean = false;

  constructor(maxConcurrency: number) {
    this.controller = new ConcurrencyController<T>(maxConcurrency);
  }

  /**
   * Add a task to the queue
   */
  enqueue(taskId: string, task: () => Promise<T>): Promise<Result<T, ConcurrencyError>> {
    return new Promise((resolve) => {
      this.queue.push({
        id: taskId,
        task,
        resolve,
      });

      this.processQueue();
    });
  }

  /**
   * Process queued tasks
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && !this.controller.isStopped()) {
      const queueItem = this.queue.shift();
      if (!queueItem) {
        break;
      }

      // Execute task without waiting for completion
      this.controller
        .executeTask(queueItem.id, queueItem.task)
        .then(queueItem.resolve)
        .catch((_error) => {
          queueItem.resolve(
            Err({
              message: `Queue task ${queueItem.id} failed`,
              cause: _error,
            })
          );
        });
    }

    this.processing = false;
  }

  /**
   * Stop the task queue
   */
  stop(): void {
    this.controller.stop();
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number;
    controllerStats: ReturnType<ConcurrencyController<T>["getStats"]>;
  } {
    return {
      queueLength: this.queue.length,
      controllerStats: this.controller.getStats(),
    };
  }
}
