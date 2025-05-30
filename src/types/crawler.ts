import type { SingleUrlAuditResult } from "./issues";

/**
 * Error type for crawler operations
 */
export type CrawlerError = {
  readonly message: string;
  readonly cause?: unknown;
  readonly url?: string;
};

/**
 * Item in the crawl queue
 */
export type CrawlQueueItem = {
  readonly url: string;
  readonly normalizedUrl: string;
  readonly depth: number;
  readonly parentUrl?: string;
  readonly discoveredAt: number;
};

/**
 * Status of a page during crawling
 */
export type PageStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

/**
 * Page result from crawling
 */
export type CrawlPageResult = {
  readonly url: string;
  readonly normalizedUrl: string;
  readonly depth: number;
  readonly parentUrl?: string;
  readonly status: PageStatus;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly error?: string;
  readonly linksFound?: number;
  readonly auditResult?: SingleUrlAuditResult;
};

/**
 * Crawl state management
 */
export type CrawlState = {
  readonly visited: Set<string>;
  readonly queue: CrawlQueueItem[];
  readonly processing: Set<string>;
  readonly results: CrawlPageResult[];
  readonly startTime: number;
  totalPagesDiscovered: number;
  pagesSkipped: number;
  readonly errors: CrawlerError[];
  stopped: boolean;
};

/**
 * Crawl statistics
 */
export type CrawlStats = {
  readonly startUrl: string;
  readonly totalPagesProcessed: number;
  readonly totalPagesDiscovered: number;
  readonly pagesSkipped: number;
  readonly maxDepthReached: number;
  readonly crawlDuration: number;
  readonly averagePageTime: number;
  readonly successfulPages: number;
  readonly failedPages: number;
  readonly totalLinksFound: number;
  readonly uniqueLinksFound: number;
};

/**
 * Link discovery information
 */
export type LinkDiscovery = {
  readonly sourceUrl: string;
  readonly targetUrl: string;
  readonly normalizedTargetUrl: string;
  readonly depth: number;
  readonly linkText?: string;
  readonly discoveredAt: number;
};

/**
 * Crawl metadata for results
 */
export type CrawlMetadata = {
  readonly startUrl: string;
  readonly maxDepthReached: number;
  readonly totalPagesDiscovered: number;
  readonly pagesSkipped: number;
  readonly crawlDuration: number;
  readonly averagePageTime: number;
  readonly successfulPages: number;
  readonly failedPages: number;
  readonly linkGraph?: LinkDiscovery[];
  readonly crawlStats: CrawlStats;
};
