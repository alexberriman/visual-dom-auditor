import { describe, it, expect, beforeEach } from "vitest";
import { CrawlerStateManager } from "./crawler-state";
import type { CrawlConfig } from "../types/config";
import type { CrawlPageResult } from "../types/crawler";

describe("CrawlerStateManager", () => {
  let stateManager: CrawlerStateManager;
  const defaultConfig: CrawlConfig = {
    enabled: true,
    maxDepth: 3,
    maxPages: 10,
    maxThreads: 2,
    includeSubdomains: true,
    excludePatterns: [],
    includePatterns: [],
  };

  beforeEach(() => {
    stateManager = new CrawlerStateManager("https://example.com", defaultConfig);
  });

  describe("enqueueUrl", () => {
    it("should enqueue new URLs successfully", () => {
      const result = stateManager.enqueueUrl(
        "https://example.com/page1",
        "https://example.com/page1",
        1,
        "https://example.com"
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBe(true);
      }
    });

    it("should not enqueue already visited URLs", () => {
      // First enqueue and dequeue to mark as visited
      stateManager.enqueueUrl("https://example.com/page1", "https://example.com/page1", 1);
      const dequeueResult = stateManager.dequeueUrl();
      expect(dequeueResult.ok).toBe(true);

      // Try to enqueue the same URL again
      const result = stateManager.enqueueUrl(
        "https://example.com/page1",
        "https://example.com/page1",
        1
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBe(false);
      }
    });

    it("should respect max depth limit", () => {
      const result = stateManager.enqueueUrl(
        "https://example.com/deep",
        "https://example.com/deep",
        4 // Exceeds maxDepth of 3
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBe(false);
      }

      const state = stateManager.getState();
      expect(state.pagesSkipped).toBe(1);
    });

    it("should respect max pages limit", () => {
      // Fill up to max pages
      for (let i = 0; i < 10; i++) {
        stateManager.enqueueUrl(`https://example.com/page${i}`, `https://example.com/page${i}`, 1);
      }

      // Try to add one more
      const result = stateManager.enqueueUrl(
        "https://example.com/page11",
        "https://example.com/page11",
        1
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBe(false);
      }

      const state = stateManager.getState();
      expect(state.pagesSkipped).toBe(1);
    });

    it("should maintain queue priority by depth", () => {
      // Add URLs with different depths
      stateManager.enqueueUrl("https://example.com/deep", "https://example.com/deep", 3);
      stateManager.enqueueUrl("https://example.com/shallow", "https://example.com/shallow", 1);
      stateManager.enqueueUrl("https://example.com/medium", "https://example.com/medium", 2);

      // Dequeue and check order (should be depth 1, 2, 3)
      const first = stateManager.dequeueUrl();
      expect(first.ok).toBe(true);
      if (first.ok && first.val) {
        expect(first.val.depth).toBe(1);
      }

      const second = stateManager.dequeueUrl();
      expect(second.ok).toBe(true);
      if (second.ok && second.val) {
        expect(second.val.depth).toBe(2);
      }

      const third = stateManager.dequeueUrl();
      expect(third.ok).toBe(true);
      if (third.ok && third.val) {
        expect(third.val.depth).toBe(3);
      }
    });
  });

  describe("dequeueUrl", () => {
    it("should return null when queue is empty", () => {
      const result = stateManager.dequeueUrl();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBeNull();
      }
    });

    it("should respect max threads limit", () => {
      // Add URLs
      for (let i = 0; i < 5; i++) {
        stateManager.enqueueUrl(`https://example.com/page${i}`, `https://example.com/page${i}`, 1);
      }

      // Dequeue up to max threads (2)
      const first = stateManager.dequeueUrl();
      const second = stateManager.dequeueUrl();

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);

      // Third should be null due to max threads
      const third = stateManager.dequeueUrl();
      expect(third.ok).toBe(true);
      if (third.ok) {
        expect(third.val).toBeNull();
      }
    });

    it("should mark URLs as visited and processing", () => {
      stateManager.enqueueUrl("https://example.com/page1", "https://example.com/page1", 1);

      const result = stateManager.dequeueUrl();
      expect(result.ok).toBe(true);

      const state = stateManager.getState();
      expect(state.visited.has("https://example.com/page1")).toBe(true);
      expect(state.processing.has("https://example.com/page1")).toBe(true);
    });
  });

  describe("completeUrl", () => {
    it("should complete URL and remove from processing", () => {
      // Enqueue and dequeue a URL
      stateManager.enqueueUrl("https://example.com/page1", "https://example.com/page1", 1);
      stateManager.dequeueUrl();

      // Complete the URL
      const pageResult: Omit<CrawlPageResult, "normalizedUrl"> = {
        url: "https://example.com/page1",
        depth: 1,
        status: "completed",
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        duration: 1000,
        linksFound: 5,
      };

      const result = stateManager.completeUrl("https://example.com/page1", pageResult);

      expect(result.ok).toBe(true);

      const state = stateManager.getState();
      expect(state.processing.has("https://example.com/page1")).toBe(false);
      expect(state.results).toHaveLength(1);
      expect(state.results[0].status).toBe("completed");
    });
  });

  describe("state management", () => {
    it("should track errors correctly", () => {
      stateManager.addError({
        message: "Test error",
        url: "https://example.com/error",
      });

      const state = stateManager.getState();
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].message).toBe("Test error");
    });

    it("should stop the crawler", () => {
      stateManager.stop();

      expect(stateManager.shouldContinue()).toBe(false);

      const state = stateManager.getState();
      expect(state.stopped).toBe(true);
    });

    it("should determine shouldContinue correctly", () => {
      // Initially should not continue (empty queue)
      expect(stateManager.shouldContinue()).toBe(false);

      // Add URL to queue
      stateManager.enqueueUrl("https://example.com/page1", "https://example.com/page1", 1);
      expect(stateManager.shouldContinue()).toBe(true);

      // Stop the crawler
      stateManager.stop();
      expect(stateManager.shouldContinue()).toBe(false);
    });

    it("should determine hasUrlsToProcess correctly", () => {
      // Initially false (empty queue)
      expect(stateManager.hasUrlsToProcess()).toBe(false);

      // Add URL
      stateManager.enqueueUrl("https://example.com/page1", "https://example.com/page1", 1);
      expect(stateManager.hasUrlsToProcess()).toBe(true);

      // Max out threads
      stateManager.dequeueUrl();
      stateManager.enqueueUrl("https://example.com/page2", "https://example.com/page2", 1);
      stateManager.dequeueUrl();

      // Now we have URLs but max threads reached
      stateManager.enqueueUrl("https://example.com/page3", "https://example.com/page3", 1);
      expect(stateManager.hasUrlsToProcess()).toBe(false);
    });
  });

  describe("getStats", () => {
    it("should calculate statistics correctly", () => {
      const startUrl = "https://example.com";

      // Add some completed results
      stateManager.enqueueUrl("https://example.com/page1", "https://example.com/page1", 1);
      stateManager.enqueueUrl("https://example.com/page2", "https://example.com/page2", 2);

      // Process URLs
      stateManager.dequeueUrl();
      stateManager.completeUrl("https://example.com/page1", {
        url: "https://example.com/page1",
        depth: 1,
        status: "completed",
        startTime: Date.now() - 2000,
        endTime: Date.now() - 1000,
        duration: 1000,
        linksFound: 10,
      });

      stateManager.dequeueUrl();
      stateManager.completeUrl("https://example.com/page2", {
        url: "https://example.com/page2",
        depth: 2,
        status: "failed",
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        duration: 1000,
        error: "Page load failed",
      });

      const stats = stateManager.getStats(startUrl);

      expect(stats.startUrl).toBe(startUrl);
      expect(stats.totalPagesProcessed).toBe(2);
      expect(stats.successfulPages).toBe(1);
      expect(stats.failedPages).toBe(1);
      expect(stats.totalLinksFound).toBe(10);
      expect(stats.maxDepthReached).toBe(2);
      expect(stats.uniqueLinksFound).toBe(2);
    });

    it("should handle empty stats correctly", () => {
      const stats = stateManager.getStats("https://example.com");

      expect(stats.totalPagesProcessed).toBe(0);
      expect(stats.successfulPages).toBe(0);
      expect(stats.failedPages).toBe(0);
      expect(stats.totalLinksFound).toBe(0);
      expect(stats.maxDepthReached).toBe(0);
      expect(stats.averagePageTime).toBe(0);
    });
  });

  describe("getSuccessfulResults", () => {
    it("should return only successful results with audit data", () => {
      // Add mixed results
      stateManager.enqueueUrl("https://example.com/success", "https://example.com/success", 1);
      stateManager.enqueueUrl("https://example.com/fail", "https://example.com/fail", 1);
      stateManager.enqueueUrl("https://example.com/no-audit", "https://example.com/no-audit", 1);

      // Process and complete with different statuses
      stateManager.dequeueUrl();
      stateManager.completeUrl("https://example.com/success", {
        url: "https://example.com/success",
        depth: 1,
        status: "completed",
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 100,
        auditResult: {
          url: "https://example.com/success",
          timestamp: new Date().toISOString(),
          viewport: { width: 1920, height: 1080 },
          issues: [],
          metadata: {
            totalIssuesFound: 0,
            criticalIssues: 0,
            majorIssues: 0,
            minorIssues: 0,
            issuesByType: {
              overlap: 0,
              padding: 0,
              spacing: 0,
              "container-overflow": 0,
              scrollbar: 0,
              layout: 0,
              centering: 0,
              "console-error": 0,
            },
          },
        },
      });

      stateManager.dequeueUrl();
      stateManager.completeUrl("https://example.com/fail", {
        url: "https://example.com/fail",
        depth: 1,
        status: "failed",
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 100,
        error: "Failed to load",
      });

      // Release a thread to process third URL
      stateManager.dequeueUrl();
      stateManager.completeUrl("https://example.com/no-audit", {
        url: "https://example.com/no-audit",
        depth: 1,
        status: "completed",
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 100,
        // No auditResult
      });

      const successful = stateManager.getSuccessfulResults();
      expect(successful).toHaveLength(1);
      expect(successful[0].url).toBe("https://example.com/success");
      expect(successful[0].auditResult).toBeDefined();
    });
  });
});
