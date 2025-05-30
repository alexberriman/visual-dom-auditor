import { Command } from "commander";
import type { Config, CrawlConfig } from "../types/config";
import { Ok, Err, type Result } from "../types/ts-results";
import { detectors, disabledDetectors } from "../core/detectors";

const VIEWPORT_PRESETS = {
  desktop: "1920x1080",
  tablet: "768x1024",
  mobile: "375x667",
};

type ParseCliError = {
  message: string;
};

/**
 * Validates detector input from command line options
 */
const validateDetectors = (detectorInput?: string): Result<string[], ParseCliError> => {
  if (!detectorInput) {
    return Ok([]);
  }

  // Parse detectors separated by comma or space
  const detectorNames = detectorInput
    .split(/[,\s]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  // Get all available detector names (enabled + disabled)
  const availableDetectors = { ...detectors, ...disabledDetectors };
  const availableNames = Object.keys(availableDetectors);

  // Validate detector names
  for (const name of detectorNames) {
    if (!availableNames.includes(name)) {
      return Err({
        message: `Unknown detector: ${name}. Available detectors: ${availableNames.join(", ")}`,
      });
    }
  }

  return Ok(detectorNames);
};

/**
 * Validates URL input from command line options
 */
const validateUrls = (options: {
  url?: string;
  urls?: string[];
  crawl?: boolean;
}): Result<string[], ParseCliError> => {
  const urls: string[] = [];

  if (options.url && options.urls) {
    return Err({
      message:
        "Cannot specify both --url and --urls. Use --url for single URL or --urls for multiple URLs",
    });
  }

  if (!options.url && !options.urls) {
    return Err({ message: "Either --url or --urls is required" });
  }

  // When crawling, only allow single URL
  if (options.crawl && options.urls && options.urls.length > 1) {
    return Err({
      message: "Crawling mode only supports a single starting URL. Use --url instead of --urls",
    });
  }

  if (options.url) {
    urls.push(options.url);
  } else if (options.urls) {
    urls.push(...options.urls);
  }

  // Validate all URLs
  for (const url of urls) {
    try {
      new globalThis.URL(url);
    } catch {
      return Err({ message: `Invalid URL: ${url}` });
    }
  }

  return Ok(urls);
};

/**
 * Parses and validates command line arguments
 */
export const parseCli = (): Result<Config, ParseCliError> => {
  const program = new Command();

  program
    .name("visual-dom-auditor")
    .description("Detect critical layout issues on webpages using a headless browser")
    .version("0.1.0");

  program
    .option("--url <url>", "URL to analyze (use this for single URL)")
    .option("--urls <urls...>", "Multiple URLs to analyze")
    .option(
      "--viewport <viewport>",
      "Viewport size (desktop, tablet, mobile, or custom widthxheight)",
      "desktop"
    )
    .option("--format <format>", "Output format", "json")
    .option("--save <path>", "Save output to file")
    .option("--exit-early", "Exit on first critical error found")
    .option(
      "--detectors <detectors>",
      "Comma or space-separated list of detectors to run (omit to use defaults)"
    )
    .option("--verbose", "Enable verbose logging")
    .option("--crawl", "Enable crawling mode to discover and analyze linked pages")
    .option("--max-depth <number>", "Maximum crawl depth", "3")
    .option("--max-pages <number>", "Maximum total pages to crawl", "50")
    .option("--max-threads <number>", "Maximum concurrent threads for crawling", "3");

  program.parse();

  const options = program.opts();

  // Set verbose logging environment variable if --verbose flag is used
  if (options.verbose) {
    process.env.VERBOSE_LOGGING = "true";
  }

  // Validate URL input
  const urlValidationResult = validateUrls(options);
  if (urlValidationResult.err) {
    return urlValidationResult;
  }
  const urls = urlValidationResult.val;

  // Validate detector input
  const detectorValidationResult = validateDetectors(options.detectors);
  if (detectorValidationResult.err) {
    return detectorValidationResult;
  }
  const selectedDetectors = detectorValidationResult.val;

  // Process viewport
  let viewportWidth = 1920;
  let viewportHeight = 1080;

  if (options.viewport) {
    if (options.viewport in VIEWPORT_PRESETS) {
      const preset = VIEWPORT_PRESETS[options.viewport as keyof typeof VIEWPORT_PRESETS];
      const [width, height] = preset.split("x").map(Number);
      viewportWidth = width;
      viewportHeight = height;
    } else if (/^\d+x\d+$/.test(options.viewport)) {
      const [width, height] = options.viewport.split("x").map(Number);
      viewportWidth = width;
      viewportHeight = height;
    } else {
      return Err({
        message: `Invalid viewport format: ${options.viewport}. Use 'desktop', 'tablet', 'mobile', or custom 'widthxheight'`,
      });
    }
  }

  // Validate format
  if (options.format && options.format !== "json") {
    return Err({
      message: `Unsupported format: ${options.format}. Currently only 'json' is supported`,
    });
  }

  // Parse and validate crawling options
  let crawlConfig: CrawlConfig | undefined;
  if (options.crawl) {
    const maxDepth = parseInt(options.maxDepth, 10);
    const maxPages = parseInt(options.maxPages, 10);
    const maxThreads = parseInt(options.maxThreads, 10);

    if (isNaN(maxDepth) || maxDepth < 1 || maxDepth > 10) {
      return Err({
        message: "Invalid max-depth: must be a number between 1 and 10",
      });
    }

    if (isNaN(maxPages) || maxPages < 1 || maxPages > 1000) {
      return Err({
        message: "Invalid max-pages: must be a number between 1 and 1000",
      });
    }

    if (isNaN(maxThreads) || maxThreads < 1 || maxThreads > 10) {
      return Err({
        message: "Invalid max-threads: must be a number between 1 and 10",
      });
    }

    crawlConfig = {
      enabled: true,
      maxDepth,
      maxPages,
      maxThreads,
      includeSubdomains: true,
      excludePatterns: [
        "/login",
        "/logout",
        "/signin",
        "/signup",
        "/register",
        "/admin",
        "/dashboard",
        "/account",
        "/profile",
        "/download",
        "/print",
        "/pdf",
        "/export",
      ],
      includePatterns: [],
    };
  }

  return Ok({
    urls,
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
    format: options.format || "json",
    savePath: options.save,
    exitEarly: Boolean(options.exitEarly),
    detectors: selectedDetectors.length > 0 ? selectedDetectors : undefined,
    crawl: crawlConfig,
  });
};
