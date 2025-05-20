import { Command } from "commander";
import type { Config } from "../types/config";
import { Result, Ok, Err } from "ts-results";

const VIEWPORT_PRESETS = {
  desktop: "1920x1080",
  tablet: "768x1024",
  mobile: "375x667",
};

type ParseCliError = {
  message: string;
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
    .requiredOption("--url <url>", "URL to analyze")
    .option(
      "--viewport <viewport>",
      "Viewport size (desktop, tablet, mobile, or custom widthxheight)",
      "desktop"
    )
    .option("--format <format>", "Output format", "json")
    .option("--save <path>", "Save output to file");

  program.parse();

  const options = program.opts();

  // Validate URL
  if (!options.url) {
    return Err({ message: "URL is required" });
  }

  try {
    // Use globalThis.URL to avoid the no-undef error
    new globalThis.URL(options.url);
  } catch {
    return Err({ message: `Invalid URL: ${options.url}` });
  }

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

  return Ok({
    url: options.url,
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
    format: options.format || "json",
    savePath: options.save,
  });
};
