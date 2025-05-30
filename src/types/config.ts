/**
 * Viewport configuration
 */
export type Viewport = {
  readonly width: number;
  readonly height: number;
};

/**
 * Output format type
 */
export type OutputFormat = "json";

/**
 * Crawling configuration
 */
export type CrawlConfig = {
  readonly enabled: boolean;
  readonly maxDepth: number;
  readonly maxPages: number;
  readonly maxThreads: number;
  readonly includeSubdomains: boolean;
  readonly excludePatterns: readonly string[];
  readonly includePatterns: readonly string[];
};

/**
 * CLI configuration
 */
export type Config = {
  readonly urls: readonly string[];
  readonly viewport: Viewport;
  readonly format: OutputFormat;
  readonly savePath?: string;
  readonly exitEarly: boolean;
  readonly detectors?: readonly string[];
  readonly crawl?: CrawlConfig;
};

/**
 * Viewport preset names
 */
export type ViewportPreset = "desktop" | "tablet" | "mobile";
