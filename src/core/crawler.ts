import type { Browser, Page } from "playwright-core";
import { Ok, Err, type Result } from "../types/ts-results";
import type { Config, CrawlConfig } from "../types/config";
import type { CrawlPageResult, CrawlStats } from "../types/crawler";
import type { SingleUrlAuditResult, CrawlAuditResult } from "../types/issues";
import { CrawlerStateManager } from "./crawler-state";
import { ConcurrencyController } from "../utils/concurrency";
import { extractUniqueUrls } from "../utils/link-extractor";
import { normalizeUrl } from "../utils/url-normalizer";
import { preparePageForUrl } from "./browser";
import { spinner } from "../utils/spinner";
import { setLoggerUrlContext } from "../utils/logger";

/**
 * Error type for crawler operations
 */
type CrawlerEngineError = {
  message: string;
  cause?: unknown;
};

/**
 * Page processing function type
 */
type PageProcessor = (
  _page: Page,
  _url: string,
  _consoleDetector?: import("./detectors/console-error").ConsoleErrorDetector
) => Promise<Result<SingleUrlAuditResult, unknown>>;

/**
 * Main crawler engine
 */
export class CrawlerEngine {
  private readonly config: Config;
  private readonly crawlConfig: CrawlConfig;
  private readonly stateManager: CrawlerStateManager;
  private readonly concurrencyController: ConcurrencyController<CrawlPageResult>;
  private readonly pageProcessor: PageProcessor;

  constructor(config: Config, crawlConfig: CrawlConfig, pageProcessor: PageProcessor) {
    this.config = config;
    this.crawlConfig = crawlConfig;
    this.stateManager = new CrawlerStateManager(config.urls[0], crawlConfig);
    this.concurrencyController = new ConcurrencyController(crawlConfig.maxThreads);
    this.pageProcessor = pageProcessor;
  }

  /**
   * Start the crawling process
   */
  async crawl(browser: Browser): Promise<Result<CrawlAuditResult, CrawlerEngineError>> {
    try {
      const startUrl = this.config.urls[0];

      // Normalize and enqueue the starting URL
      const normalizeResult = normalizeUrl(startUrl);
      if (normalizeResult.err) {
        return Err({
          message: `Failed to normalize start URL: ${startUrl}`,
          cause: normalizeResult.val,
        });
      }

      const normalizedStartUrl = normalizeResult.val;

      // Enqueue the starting URL with depth 0
      const enqueueResult = this.stateManager.enqueueUrl(startUrl, normalizedStartUrl, 0);

      if (enqueueResult.err) {
        return Err({
          message: "Failed to enqueue start URL",
          cause: enqueueResult.val,
        });
      }

      spinner.start(`🕷️  Starting crawl from ${startUrl}...`, {
        color: "cyan",
        spinner: "dots12",
      });

      // Main crawling loop
      while (this.stateManager.shouldContinue()) {
        const processingTasks: Promise<void>[] = [];

        // Start processing available URLs
        while (this.stateManager.hasUrlsToProcess()) {
          const dequeueResult = this.stateManager.dequeueUrl();

          if (dequeueResult.err) {
            this.stateManager.addError({
              message: "Failed to dequeue URL",
              cause: dequeueResult.val,
            });
            break;
          }

          const queueItem = dequeueResult.val;
          if (!queueItem) {
            break; // No more URLs available for processing
          }

          // Start processing this URL concurrently
          const processingTask = this.processUrl(browser, queueItem);
          processingTasks.push(processingTask);
        }

        // Wait for at least one task to complete before continuing
        if (processingTasks.length > 0) {
          await Promise.race(processingTasks);
        } else {
          // No tasks to process, wait a bit and check again
          await this.delay(100);
        }

        // Update progress
        this.updateProgress();
      }

      // Wait for all remaining tasks to complete
      spinner.update("🔄 Finishing remaining page analyses...");
      while (this.stateManager.getState().processing.size > 0) {
        await this.delay(100);
      }

      const stats = this.stateManager.getStats(startUrl);
      const successfulResults = this.stateManager.getSuccessfulResults();

      spinner.succeed(
        `✅ Crawl complete - Analyzed ${stats.successfulPages}/${stats.totalPagesProcessed} pages in ${Math.round(stats.crawlDuration / 1000)}s`
      );

      return Ok(this.createCrawlAuditResult(stats, successfulResults));
    } catch (error) {
      this.concurrencyController.stop();
      return Err({
        message: "Crawler engine failed",
        cause: error,
      });
    }
  }

  /**
   * Stop the crawler
   */
  stop(): void {
    this.stateManager.stop();
    this.concurrencyController.stop();
  }

  /**
   * Process a single URL
   */
  private async processUrl(
    browser: Browser,
    queueItem: import("../types/crawler").CrawlQueueItem
  ): Promise<void> {
    const startTime = Date.now();
    let pageResult: CrawlPageResult;

    try {
      // Set URL context for logging
      setLoggerUrlContext(queueItem.url);

      // Create console error detector
      const { ConsoleErrorDetector } = await import("./detectors/console-error");
      const consoleDetector = new ConsoleErrorDetector();

      // Prepare page
      const pagePreparationResult = await preparePageForUrl(
        browser,
        queueItem.url,
        this.config.viewport,
        consoleDetector
      );

      if (pagePreparationResult.err) {
        pageResult = {
          url: queueItem.url,
          normalizedUrl: queueItem.normalizedUrl,
          depth: queueItem.depth,
          parentUrl: queueItem.parentUrl,
          status: "failed",
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          error: pagePreparationResult.val.message,
        };

        this.stateManager.completeUrl(queueItem.normalizedUrl, pageResult);

        // If exit early is enabled and this is a critical error, stop crawling
        if (this.config.exitEarly) {
          this.stateManager.stop();
        }

        return;
      }

      const page = pagePreparationResult.val;

      try {
        // Run page analysis
        const analysisResult = await this.pageProcessor(page, queueItem.url, consoleDetector);

        if (analysisResult.err) {
          pageResult = {
            url: queueItem.url,
            normalizedUrl: queueItem.normalizedUrl,
            depth: queueItem.depth,
            parentUrl: queueItem.parentUrl,
            status: "failed",
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            error: "Page analysis failed",
          };
        } else {
          const auditResult = analysisResult.val;

          // Check for early exit on critical issues
          const hasCriticalIssues = auditResult.metadata.criticalIssues > 0;
          if (this.config.exitEarly && hasCriticalIssues) {
            this.stateManager.stop();
          }

          // Extract links for further crawling
          let linksFound = 0;
          if (queueItem.depth < this.crawlConfig.maxDepth) {
            const linksResult = await extractUniqueUrls(page, queueItem.url, {
              includeSubdomains: this.crawlConfig.includeSubdomains,
              excludePatterns: this.crawlConfig.excludePatterns,
              includePatterns: this.crawlConfig.includePatterns,
            });

            if (linksResult.ok) {
              const urls = linksResult.val;
              linksFound = urls.length;

              // Enqueue discovered URLs
              for (const discoveredUrl of urls) {
                this.stateManager.enqueueUrl(
                  discoveredUrl,
                  discoveredUrl, // Already normalized by extractUniqueUrls
                  queueItem.depth + 1,
                  queueItem.url
                );
              }
            }
          }

          pageResult = {
            url: queueItem.url,
            normalizedUrl: queueItem.normalizedUrl,
            depth: queueItem.depth,
            parentUrl: queueItem.parentUrl,
            status: "completed",
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            linksFound,
            auditResult,
          };
        }
      } finally {
        // Always close the page
        await page.close();
      }
    } catch (error) {
      pageResult = {
        url: queueItem.url,
        normalizedUrl: queueItem.normalizedUrl,
        depth: queueItem.depth,
        parentUrl: queueItem.parentUrl,
        status: "failed",
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Mark URL as completed
    this.stateManager.completeUrl(queueItem.normalizedUrl, pageResult);
  }

  /**
   * Update crawling progress
   */
  private updateProgress(): void {
    const state = this.stateManager.getState();
    const stats = this.stateManager.getStats(this.config.urls[0]);

    const queueLength = state.queue.length;
    const processingCount = state.processing.size;
    const completedCount = stats.totalPagesProcessed;

    if (processingCount > 0 || queueLength > 0) {
      spinner.update(
        `🕷️  Crawling: ${completedCount} done, ${processingCount} processing, ${queueLength} queued`
      );
    }
  }

  /**
   * Create crawl audit result from stats and results
   */
  private createCrawlAuditResult(stats: CrawlStats, results: CrawlPageResult[]): CrawlAuditResult {
    // Extract audit results from successful page results
    const auditResults: SingleUrlAuditResult[] = results
      .filter((result) => result.auditResult)
      .map((result) => result.auditResult as SingleUrlAuditResult);

    // Calculate summary statistics
    const summary = {
      totalUrls: auditResults.length,
      urlsWithIssues: auditResults.filter((r) => r.metadata.totalIssuesFound > 0).length,
      totalIssuesFound: auditResults.reduce((sum, r) => sum + r.metadata.totalIssuesFound, 0),
      criticalIssues: auditResults.reduce((sum, r) => sum + r.metadata.criticalIssues, 0),
      majorIssues: auditResults.reduce((sum, r) => sum + r.metadata.majorIssues, 0),
      minorIssues: auditResults.reduce((sum, r) => sum + r.metadata.minorIssues, 0),
      issuesByType: auditResults.reduce(
        (acc, r) => {
          for (const [type, count] of Object.entries(r.metadata.issuesByType)) {
            acc[type as keyof typeof acc] = (acc[type as keyof typeof acc] || 0) + count;
          }
          return acc;
        },
        {
          overlap: 0,
          padding: 0,
          spacing: 0,
          "container-overflow": 0,
          scrollbar: 0,
          layout: 0,
          centering: 0,
          "console-error": 0,
        }
      ),
    };

    const crawlAuditResult: CrawlAuditResult = {
      timestamp: new Date().toISOString(),
      viewport: this.config.viewport,
      results: auditResults,
      summary,
      exitedEarly: this.stateManager.getState().stopped,
      crawlMetadata: {
        startUrl: stats.startUrl,
        maxDepthReached: stats.maxDepthReached,
        totalPagesDiscovered: stats.totalPagesDiscovered,
        pagesSkipped: stats.pagesSkipped,
        crawlDuration: stats.crawlDuration,
        averagePageTime: stats.averagePageTime,
        successfulPages: stats.successfulPages,
        failedPages: stats.failedPages,
      },
    };

    return crawlAuditResult;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
