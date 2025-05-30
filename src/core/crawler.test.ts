import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chromium, type Browser, type Page } from "playwright-core";
import { CrawlerEngine } from "./crawler";
import type { Config, CrawlConfig } from "../types/config";
import type { SingleUrlAuditResult } from "../types/issues";
import { Ok, Err } from "../types/ts-results";

// Mock the dependencies
vi.mock("./browser", () => ({
  preparePageForUrl: vi.fn(),
}));

vi.mock("../utils/link-extractor", () => ({
  extractUniqueUrls: vi.fn(),
}));

vi.mock("../utils/spinner", () => ({
  spinner: {
    start: vi.fn(),
    update: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
    clear: vi.fn(),
    setUrlContext: vi.fn(),
  },
}));

vi.mock("../utils/logger", () => ({
  setLoggerUrlContext: vi.fn(),
}));

describe("CrawlerEngine", () => {
  let browser: Browser;
  let mockPage: Page;
  let crawler: CrawlerEngine;

  const defaultConfig: Config = {
    urls: ["https://example.com"],
    viewport: { width: 1920, height: 1080 },
    format: "json",
    exitEarly: false,
  };

  const crawlConfig: CrawlConfig = {
    enabled: true,
    maxDepth: 2,
    maxPages: 10,
    maxThreads: 2,
    includeSubdomains: true,
    excludePatterns: [],
    includePatterns: [],
  };

  const mockAuditResult: SingleUrlAuditResult = {
    url: "https://example.com",
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
  };

  const mockPageProcessor = vi.fn().mockResolvedValue(Ok(mockAuditResult));

  beforeEach(async () => {
    // Create real browser and page for testing
    browser = await chromium.launch({ headless: true });
    mockPage = await browser.newPage();

    // Reset mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    const { preparePageForUrl } = await import("./browser");
    vi.mocked(preparePageForUrl).mockResolvedValue(Ok(mockPage));

    const { extractUniqueUrls } = await import("../utils/link-extractor");
    vi.mocked(extractUniqueUrls).mockResolvedValue(Ok([]));

    crawler = new CrawlerEngine(defaultConfig, crawlConfig, mockPageProcessor);
  });

  afterEach(async () => {
    await browser.close();
  });

  describe("crawl", () => {
    it("should crawl starting URL successfully", async () => {
      const result = await crawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.crawlMetadata.startUrl).toBe("https://example.com");
        expect(result.val.crawlMetadata.successfulPages).toBe(1);
        expect(result.val.results).toHaveLength(1);
      }
    });

    it("should discover and crawl linked pages", async () => {
      const { extractUniqueUrls } = await import("../utils/link-extractor");

      // Mock link discovery
      vi.mocked(extractUniqueUrls)
        .mockResolvedValueOnce(Ok(["https://example.com/page1", "https://example.com/page2"]))
        .mockResolvedValue(Ok([])); // No more links on subsequent pages

      const result = await crawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.crawlMetadata.totalPagesDiscovered).toBe(3); // Start + 2 discovered
        expect(result.val.crawlMetadata.successfulPages).toBe(3);
        expect(result.val.results).toHaveLength(3);
      }
    });

    it("should respect max depth limit", async () => {
      const { extractUniqueUrls } = await import("../utils/link-extractor");

      // Mock deep link structure
      vi.mocked(extractUniqueUrls)
        .mockResolvedValueOnce(Ok(["https://example.com/level1"])) // Depth 0 -> 1
        .mockResolvedValueOnce(Ok(["https://example.com/level2"])) // Depth 1 -> 2
        .mockResolvedValueOnce(Ok(["https://example.com/level3"])) // Depth 2 -> 3 (should skip)
        .mockResolvedValue(Ok([]));

      const result = await crawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should only crawl start, level1, and level2 (max depth 2)
        expect(result.val.crawlMetadata.successfulPages).toBe(3);
        expect(result.val.crawlMetadata.maxDepthReached).toBe(2);
      }
    });

    it("should respect max pages limit", async () => {
      const { extractUniqueUrls } = await import("../utils/link-extractor");

      // Configure crawler with low page limit
      const limitedCrawlConfig = { ...crawlConfig, maxPages: 3 };
      const limitedCrawler = new CrawlerEngine(
        defaultConfig,
        limitedCrawlConfig,
        mockPageProcessor
      );

      // Mock many discovered links
      vi.mocked(extractUniqueUrls).mockResolvedValue(
        Ok([
          "https://example.com/page1",
          "https://example.com/page2",
          "https://example.com/page3",
          "https://example.com/page4",
          "https://example.com/page5",
        ])
      );

      const result = await limitedCrawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // The crawler should process exactly the max pages limit (3)
        expect(result.val.crawlMetadata.successfulPages).toBe(3);
        // Some pages should be skipped due to the limit
        expect(result.val.crawlMetadata.totalPagesDiscovered).toBeGreaterThanOrEqual(
          result.val.crawlMetadata.successfulPages
        );
        expect(result.val.crawlMetadata.pagesSkipped).toBeGreaterThan(0);
      }
    });

    it("should handle page failures gracefully", async () => {
      const { preparePageForUrl } = await import("./browser");

      // Mock page preparation failure
      vi.mocked(preparePageForUrl)
        .mockResolvedValueOnce(Ok(mockPage)) // First page succeeds
        .mockResolvedValueOnce(Err({ message: "Page load failed" })); // Second page fails

      const { extractUniqueUrls } = await import("../utils/link-extractor");
      vi.mocked(extractUniqueUrls).mockResolvedValueOnce(Ok(["https://example.com/fail"]));

      const result = await crawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.crawlMetadata.successfulPages).toBe(1);
        expect(result.val.crawlMetadata.failedPages).toBe(1);
      }
    });

    it("should exit early on critical issues when configured", async () => {
      const configWithEarlyExit = { ...defaultConfig, exitEarly: true };
      const earlyExitCrawler = new CrawlerEngine(
        configWithEarlyExit,
        crawlConfig,
        mockPageProcessor
      );

      // Mock critical issue
      const criticalResult: SingleUrlAuditResult = {
        ...mockAuditResult,
        metadata: {
          ...mockAuditResult.metadata,
          criticalIssues: 1,
          totalIssuesFound: 1,
        },
      };

      mockPageProcessor.mockResolvedValueOnce(Ok(criticalResult));

      const { extractUniqueUrls } = await import("../utils/link-extractor");
      vi.mocked(extractUniqueUrls).mockResolvedValue(
        Ok(["https://example.com/page1", "https://example.com/page2"])
      );

      const result = await earlyExitCrawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.exitedEarly).toBe(true);
        expect(result.val.crawlMetadata.successfulPages).toBe(1); // Only the first page
      }
    });

    it("should handle concurrent processing", async () => {
      const { extractUniqueUrls } = await import("../utils/link-extractor");

      // Mock multiple pages discovered at once
      vi.mocked(extractUniqueUrls)
        .mockResolvedValueOnce(
          Ok([
            "https://example.com/page1",
            "https://example.com/page2",
            "https://example.com/page3",
            "https://example.com/page4",
          ])
        )
        .mockResolvedValue(Ok([]));

      // Track concurrent processing
      let concurrentCount = 0;
      let maxConcurrent = 0;

      mockPageProcessor.mockImplementation(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 50));

        concurrentCount--;
        return Ok(mockAuditResult);
      });

      const result = await crawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.crawlMetadata.successfulPages).toBe(5); // Start + 4 discovered
        expect(maxConcurrent).toBeLessThanOrEqual(crawlConfig.maxThreads);
      }
    });

    it("should handle analysis failures", async () => {
      // Mock page processor failure
      mockPageProcessor
        .mockResolvedValueOnce(Ok(mockAuditResult)) // First page succeeds
        .mockResolvedValueOnce(Err({ message: "Analysis failed" })); // Second page fails

      const { extractUniqueUrls } = await import("../utils/link-extractor");
      vi.mocked(extractUniqueUrls).mockResolvedValueOnce(Ok(["https://example.com/analyze-fail"]));

      const result = await crawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.crawlMetadata.successfulPages).toBe(1);
        expect(result.val.crawlMetadata.failedPages).toBe(1);
      }
    });

    it("should calculate crawl statistics correctly", async () => {
      const startTime = Date.now();

      const result = await crawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const metadata = result.val.crawlMetadata;

        expect(metadata.startUrl).toBe("https://example.com");
        expect(metadata.crawlDuration).toBeGreaterThan(0);
        expect(metadata.crawlDuration).toBeLessThan(Date.now() - startTime + 1000);
        expect(metadata.averagePageTime).toBeGreaterThan(0);
        expect(metadata.totalPagesDiscovered).toBeGreaterThanOrEqual(1);
      }
    });

    it("should aggregate issue counts correctly", async () => {
      // Mock results with different issue types
      const resultWithIssues: SingleUrlAuditResult = {
        ...mockAuditResult,
        issues: [
          {
            type: "overlap",
            severity: "critical",
            message: "Elements overlap",
            elements: [],
            overlapArea: { width: 10, height: 10, percentage: 50 },
          },
          {
            type: "padding",
            severity: "major",
            message: "Insufficient padding",
            elements: [],
            sides: ["top"],
            computedPadding: { top: 0, right: 10, bottom: 10, left: 10 },
          },
        ],
        metadata: {
          ...mockAuditResult.metadata,
          totalIssuesFound: 2,
          criticalIssues: 1,
          majorIssues: 1,
          issuesByType: {
            ...mockAuditResult.metadata.issuesByType,
            overlap: 1,
            padding: 1,
          },
        },
      };

      mockPageProcessor.mockResolvedValue(Ok(resultWithIssues));

      const result = await crawler.crawl(browser);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.summary.totalIssuesFound).toBe(2);
        expect(result.val.summary.criticalIssues).toBe(1);
        expect(result.val.summary.majorIssues).toBe(1);
        expect(result.val.summary.issuesByType.overlap).toBe(1);
        expect(result.val.summary.issuesByType.padding).toBe(1);
      }
    });

    it("should stop crawler when requested", () => {
      crawler.stop();

      // The crawler should handle being stopped gracefully
      // This is more of a smoke test to ensure stop() doesn't throw
      expect(() => crawler.stop()).not.toThrow();
    });
  });
});
