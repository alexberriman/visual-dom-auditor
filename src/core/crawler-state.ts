import { Ok, Err, type Result } from "../types/ts-results";
import type {
  CrawlState,
  CrawlQueueItem,
  CrawlPageResult,
  CrawlerError,
  CrawlStats,
} from "../types/crawler";
import type { CrawlConfig } from "../types/config";

/**
 * Error type for crawler state operations
 */
type CrawlerStateError = {
  message: string;
  cause?: unknown;
};

/**
 * Crawler state manager
 */
export class CrawlerStateManager {
  private state: CrawlState;
  private readonly config: CrawlConfig;

  constructor(startUrl: string, config: CrawlConfig) {
    this.config = config;
    this.state = {
      visited: new Set<string>(),
      queue: [],
      processing: new Set<string>(),
      results: [],
      startTime: Date.now(),
      totalPagesDiscovered: 0,
      pagesSkipped: 0,
      errors: [],
      stopped: false,
    };
  }

  /**
   * Add a URL to the crawl queue
   */
  enqueueUrl(
    url: string,
    normalizedUrl: string,
    depth: number,
    parentUrl?: string
  ): Result<boolean, CrawlerStateError> {
    try {
      // Check if we've already visited or queued this URL
      if (this.state.visited.has(normalizedUrl) || this.isInQueue(normalizedUrl)) {
        return Ok(false); // Already processed or queued
      }

      // Check depth limit
      if (depth > this.config.maxDepth) {
        this.state.pagesSkipped++;
        return Ok(false); // Exceeds max depth
      }

      // Check page limit
      const currentTotal = this.getTotalPagesProcessedOrQueued();
      if (currentTotal >= this.config.maxPages) {
        this.state.pagesSkipped++;
        return Ok(false); // Exceeds max pages
      }

      // Add to queue
      const queueItem: CrawlQueueItem = {
        url,
        normalizedUrl,
        depth,
        parentUrl,
        discoveredAt: Date.now(),
      };

      // Insert into queue maintaining priority (lower depth = higher priority)
      this.insertIntoQueue(queueItem);
      this.state.totalPagesDiscovered++;

      return Ok(true);
    } catch (error) {
      return Err({
        message: `Failed to enqueue URL: ${url}`,
        cause: error,
      });
    }
  }

  /**
   * Get the next URL to process from the queue
   */
  dequeueUrl(): Result<CrawlQueueItem | null, CrawlerStateError> {
    try {
      if (this.state.queue.length === 0) {
        return Ok(null);
      }

      // Check if we can process more pages concurrently
      if (this.state.processing.size >= this.config.maxThreads) {
        return Ok(null); // Too many concurrent processes
      }

      // Check if we would exceed the max pages limit
      if (this.state.results.length + this.state.processing.size >= this.config.maxPages) {
        return Ok(null); // Would exceed max pages limit
      }

      const item = this.state.queue.shift();
      if (!item) {
        return Ok(null);
      }

      // Mark as processing
      this.state.processing.add(item.normalizedUrl);
      this.state.visited.add(item.normalizedUrl);

      return Ok(item);
    } catch (error) {
      return Err({
        message: "Failed to dequeue URL",
        cause: error,
      });
    }
  }

  /**
   * Mark a URL as completed processing
   */
  completeUrl(
    normalizedUrl: string,
    result: Omit<CrawlPageResult, "normalizedUrl">
  ): Result<void, CrawlerStateError> {
    try {
      // Remove from processing set
      this.state.processing.delete(normalizedUrl);

      // Add full result to results
      const pageResult: CrawlPageResult = {
        ...result,
        normalizedUrl,
      };

      this.state.results.push(pageResult);

      return Ok(undefined);
    } catch (error) {
      return Err({
        message: `Failed to complete URL: ${normalizedUrl}`,
        cause: error,
      });
    }
  }

  /**
   * Add an error to the crawler state
   */
  addError(error: CrawlerError): void {
    this.state.errors.push(error);
  }

  /**
   * Stop the crawler
   */
  stop(): void {
    this.state.stopped = true;
  }

  /**
   * Check if the crawler should continue
   */
  shouldContinue(): boolean {
    return (
      !this.state.stopped &&
      (this.state.queue.length > 0 || this.state.processing.size > 0) &&
      this.state.results.length < this.config.maxPages
    );
  }

  /**
   * Check if there are URLs ready to process
   */
  hasUrlsToProcess(): boolean {
    return (
      !this.state.stopped &&
      this.state.queue.length > 0 &&
      this.state.processing.size < this.config.maxThreads
    );
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.state.queue.length;
  }

  /**
   * Get current crawl statistics
   */
  getStats(startUrl: string): CrawlStats {
    const now = Date.now();
    const duration = now - this.state.startTime;
    const successfulPages = this.state.results.filter((r) => r.status === "completed").length;
    const failedPages = this.state.results.filter((r) => r.status === "failed").length;
    const totalLinksFound = this.state.results.reduce((sum, r) => sum + (r.linksFound || 0), 0);
    const maxDepthReached = Math.max(0, ...this.state.results.map((r) => r.depth));
    const avgPageTime =
      successfulPages > 0
        ? this.state.results
            .filter((r) => r.status === "completed" && r.duration)
            .reduce((sum, r) => sum + (r.duration || 0), 0) / successfulPages
        : 0;

    return {
      startUrl,
      totalPagesProcessed: this.state.results.length,
      totalPagesDiscovered: this.state.totalPagesDiscovered,
      pagesSkipped: this.state.pagesSkipped,
      maxDepthReached,
      crawlDuration: duration,
      averagePageTime: avgPageTime,
      successfulPages,
      failedPages,
      totalLinksFound,
      uniqueLinksFound: this.state.visited.size,
    };
  }

  /**
   * Get current state (readonly)
   */
  getState(): Readonly<CrawlState> {
    return {
      ...this.state,
      visited: new Set(this.state.visited),
      queue: [...this.state.queue],
      processing: new Set(this.state.processing),
      results: [...this.state.results],
      errors: [...this.state.errors],
    };
  }

  /**
   * Get successful results only
   */
  getSuccessfulResults(): CrawlPageResult[] {
    return this.state.results.filter(
      (result) => result.status === "completed" && result.auditResult
    );
  }

  /**
   * Insert queue item maintaining priority order
   */
  private insertIntoQueue(item: CrawlQueueItem): void {
    // Insert maintaining priority: lower depth first, then discovery time
    let insertIndex = this.state.queue.length;

    for (let i = 0; i < this.state.queue.length; i++) {
      const existingItem = this.state.queue[i];

      if (item.depth < existingItem.depth) {
        insertIndex = i;
        break;
      } else if (
        item.depth === existingItem.depth &&
        item.discoveredAt < existingItem.discoveredAt
      ) {
        insertIndex = i;
        break;
      }
    }

    this.state.queue.splice(insertIndex, 0, item);
  }

  /**
   * Check if a URL is already in the queue
   */
  private isInQueue(normalizedUrl: string): boolean {
    return this.state.queue.some((item) => item.normalizedUrl === normalizedUrl);
  }

  /**
   * Get total pages processed or queued
   */
  private getTotalPagesProcessedOrQueued(): number {
    return this.state.results.length + this.state.queue.length;
  }
}
