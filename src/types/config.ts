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
 * CLI configuration
 */
export type Config = {
  readonly url: string;
  readonly viewport: Viewport;
  readonly format: OutputFormat;
  readonly savePath?: string;
};

/**
 * Viewport preset names
 */
export type ViewportPreset = "desktop" | "tablet" | "mobile";
