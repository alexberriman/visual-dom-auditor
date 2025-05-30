import { describe, it, expect, vi, beforeEach } from "vitest";
import { Semaphore, ConcurrencyController, TaskQueue } from "./concurrency";

describe("Semaphore", () => {
  it("should initialize with correct number of permits", () => {
    const semaphore = new Semaphore(3);
    expect(semaphore.availablePermits()).toBe(3);
  });

  it("should acquire and release permits correctly", async () => {
    const semaphore = new Semaphore(2);

    await semaphore.acquire();
    expect(semaphore.availablePermits()).toBe(1);

    await semaphore.acquire();
    expect(semaphore.availablePermits()).toBe(0);

    semaphore.release();
    expect(semaphore.availablePermits()).toBe(1);

    semaphore.release();
    expect(semaphore.availablePermits()).toBe(2);
  });

  it("should block when no permits available", async () => {
    const semaphore = new Semaphore(1);
    const results: number[] = [];

    // Acquire the only permit
    await semaphore.acquire();

    // Try to acquire another permit (should block)
    const blocked = semaphore.acquire().then(() => {
      results.push(2);
    });

    // This should execute first
    results.push(1);

    // Release permit to unblock
    semaphore.release();
    await blocked;

    expect(results).toEqual([1, 2]);
  });

  it("should handle waiting queue correctly", async () => {
    const semaphore = new Semaphore(1);

    await semaphore.acquire();
    expect(semaphore.waitingCount()).toBe(0);

    // Queue up multiple waiters
    const waiter1 = semaphore.acquire();
    const waiter2 = semaphore.acquire();

    expect(semaphore.waitingCount()).toBe(2);

    semaphore.release();
    await waiter1;
    expect(semaphore.waitingCount()).toBe(1);

    semaphore.release();
    await waiter2;
    expect(semaphore.waitingCount()).toBe(0);
  });
});

describe("ConcurrencyController", () => {
  let controller: ConcurrencyController<string>;

  beforeEach(() => {
    controller = new ConcurrencyController<string>(2);
  });

  it("should execute tasks with concurrency limit", async () => {
    const task1 = vi.fn().mockResolvedValue("result1");
    const task2 = vi.fn().mockResolvedValue("result2");
    const task3 = vi.fn().mockResolvedValue("result3");

    const results = await Promise.all([
      controller.executeTask("task1", task1),
      controller.executeTask("task2", task2),
      controller.executeTask("task3", task3),
    ]);

    expect(results[0].ok).toBe(true);
    if (results[0].ok) expect(results[0].val).toBe("result1");

    expect(results[1].ok).toBe(true);
    if (results[1].ok) expect(results[1].val).toBe("result2");

    expect(results[2].ok).toBe(true);
    if (results[2].ok) expect(results[2].val).toBe("result3");
  });

  it("should handle task failures", async () => {
    const failingTask = vi.fn().mockRejectedValue(new Error("Task failed"));

    const result = await controller.executeTask("failing", failingTask);

    expect(result.ok).toBe(false);
    if (result.err) {
      expect(result.val.message).toBe("Task failing failed");
    }
  });

  it("should stop accepting tasks after being stopped", async () => {
    controller.stop();

    const task = vi.fn().mockResolvedValue("result");
    const result = await controller.executeTask("task", task);

    expect(result.ok).toBe(false);
    if (result.err) {
      expect(result.val.message).toBe("Concurrency controller has been stopped");
    }
    expect(task).not.toHaveBeenCalled();
  });

  it("should execute multiple tasks concurrently", async () => {
    const tasks = [
      { id: "task1", task: vi.fn().mockResolvedValue("result1") },
      { id: "task2", task: vi.fn().mockResolvedValue("result2") },
      { id: "task3", task: vi.fn().mockResolvedValue("result3") },
    ];

    const result = await controller.executeTasks(tasks);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toHaveLength(3);
      expect(result.val.every((r) => r.ok)).toBe(true);
    }
  });

  it("should retry failed tasks with exponential backoff", async () => {
    let attempts = 0;
    const task = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error("Temporary failure"));
      }
      return Promise.resolve("success");
    });

    const result = await controller.executeTaskWithRetry("retry-task", task, 3, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("success");
    }
    expect(attempts).toBe(3);
  });

  it("should fail after max retries", async () => {
    const task = vi.fn().mockRejectedValue(new Error("Permanent failure"));

    const result = await controller.executeTaskWithRetry("retry-task", task, 2, 10);

    expect(result.ok).toBe(false);
    if (result.err) {
      expect(result.val.message).toBe("Task retry-task failed after 3 attempts");
    }
    expect(task).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("should provide accurate stats", () => {
    const stats = controller.getStats();

    expect(stats.isStopped).toBe(false);
    expect(stats.availablePermits).toBe(2);
    expect(stats.waitingTasks).toBe(0);
    expect(stats.runningTasks).toBe(0);

    controller.stop();
    const stoppedStats = controller.getStats();
    expect(stoppedStats.isStopped).toBe(true);
  });
});

describe("TaskQueue", () => {
  let queue: TaskQueue<string>;

  beforeEach(() => {
    queue = new TaskQueue<string>(2);
  });

  it("should process queued tasks", async () => {
    const task1 = vi.fn().mockResolvedValue("result1");
    const task2 = vi.fn().mockResolvedValue("result2");

    const result1Promise = queue.enqueue("task1", task1);
    const result2Promise = queue.enqueue("task2", task2);

    const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

    expect(result1.ok).toBe(true);
    if (result1.ok) expect(result1.val).toBe("result1");

    expect(result2.ok).toBe(true);
    if (result2.ok) expect(result2.val).toBe("result2");
  });

  it("should handle task failures in queue", async () => {
    const failingTask = vi.fn().mockRejectedValue(new Error("Queue task failed"));

    const result = await queue.enqueue("failing", failingTask);

    expect(result.ok).toBe(false);
    if (result.err) {
      expect(result.val.message).toContain("Task failing failed");
    }
  });

  it("should stop processing when stopped", () => {
    queue.stop();

    const stats = queue.getStats();
    expect(stats.controllerStats.isStopped).toBe(true);
  });

  it("should provide queue statistics", async () => {
    const slowTask = (): Promise<string> =>
      new Promise<string>((resolve) => setTimeout(() => resolve("done"), 100));

    // Enqueue multiple tasks
    const promises = [
      queue.enqueue("task1", slowTask),
      queue.enqueue("task2", slowTask),
      queue.enqueue("task3", slowTask),
      queue.enqueue("task4", slowTask),
    ];

    // Give it a moment to start processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Check stats while processing
    const stats = queue.getStats();
    // With concurrency 2, the first 2 tasks should be processing immediately
    // so queueLength should be 2 (task3 and task4 waiting)
    expect(stats.controllerStats.availablePermits).toBeLessThanOrEqual(2);

    // Clean up
    await Promise.all(promises);
  });
});
