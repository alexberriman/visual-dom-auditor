#!/usr/bin/env node

import { parseCli } from "./cli";
import { preparePage, preparePageForUrl, closeBrowser } from "./core/browser";
import { validateResult } from "./core/analyzer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
// We'll dynamically import detectors in the main function

/**
 * Process detector results and count issues by severity and type
 */
type IssueCounters = {
  allIssues: Array<import("./types/issues").Issue>;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  issuesByType: Record<string, number>;
};

/**
 * Initialize issue counters
 */
const initializeIssueCounters = (): IssueCounters => {
  return {
    allIssues: [],
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
      centering: 0, // Disabled by default due to false positives
      "flex-grid": 0, // This may be mapped to "layout" in the code
    },
  };
};

/**
 * Run all detectors on the page
 */
const runDetectors = async (
  page: import("playwright-core").Page,
  consoleDetector?: import("./core/detectors/console-error").ConsoleErrorDetector
): Promise<IssueCounters> => {
  const counters = initializeIssueCounters();

  // Import individual detectors
  const { detectors } = await import("./core/detectors");

  // Run each detector separately to prevent one failure from stopping everything
  for (const [name, detector] of Object.entries(detectors)) {
    try {
      let result;

      // Handle console error detector specially if it was provided
      if (name === "console-error" && consoleDetector) {
        // Use the early-started console detector to collect errors
        result = await consoleDetector.collectErrors(page);
      } else if (name === "console-error" && !consoleDetector) {
        // Skip the default console detector since we don't have the early-started one
        continue;
      } else {
        // Run normal detector
        result = await detector.detect(page);
      }

      if (result.ok && result.val.length > 0) {
        // Add issues to our collection
        counters.allIssues.push(...result.val);

        // Process issues and update counters
        processIssues(result.val, counters);
      }
    } catch (error) {
      // If the detector throws an exception, log it but continue with other detectors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error running ${name} detector: ${errorMessage}`);
    }
  }

  return counters;
};

/**
 * Process detector issues and update counters
 */
const processIssues = (
  issues: Array<import("./types/issues").Issue>,
  counters: IssueCounters
): void => {
  for (const issue of issues) {
    // Count by severity
    if (issue.severity === "critical") counters.criticalIssues++;
    else if (issue.severity === "major") counters.majorIssues++;
    else if (issue.severity === "minor") counters.minorIssues++;

    // Map flex-grid to layout if needed
    let issueType = issue.type;

    // Handle flex-grid type which isn't in IssueType union
    if ("type" in issue && (issue.type as string) === "flex-grid") {
      issueType = "layout";
    }

    counters.issuesByType[issueType] = (counters.issuesByType[issueType] || 0) + 1;
  }
};

/**
 * Create single URL audit result from issue counters
 */
const createSingleUrlAuditResult = (
  url: string,
  viewport: { width: number; height: number },
  counters: IssueCounters
): import("./types/issues").SingleUrlAuditResult => {
  return {
    url,
    timestamp: new Date().toISOString(),
    viewport,
    issues: counters.allIssues,
    metadata: {
      totalIssuesFound: counters.allIssues.length,
      criticalIssues: counters.criticalIssues,
      majorIssues: counters.majorIssues,
      minorIssues: counters.minorIssues,
      issuesByType: {
        overlap: counters.issuesByType.overlap || 0,
        padding: counters.issuesByType.padding || 0,
        spacing: counters.issuesByType.spacing || 0,
        "container-overflow": counters.issuesByType["container-overflow"] || 0,
        scrollbar: counters.issuesByType.scrollbar || 0,
        layout: counters.issuesByType.layout || 0,
        centering: counters.issuesByType.centering || 0, // Disabled by default
        "console-error": counters.issuesByType["console-error"] || 0,
      },
    },
  };
};

/**
 * Check if a result contains critical issues
 */
const hasCriticalIssues = (counters: IssueCounters): boolean => {
  return counters.criticalIssues > 0;
};

/**
 * Create multi-URL audit result from individual results
 */
const createMultiUrlAuditResult = (
  viewport: { width: number; height: number },
  results: import("./types/issues").SingleUrlAuditResult[],
  exitedEarly: boolean = false
): import("./types/issues").MultiUrlAuditResult => {
  const summary = {
    totalUrls: results.length,
    urlsWithIssues: results.filter((r) => r.metadata.totalIssuesFound > 0).length,
    totalIssuesFound: results.reduce((sum, r) => sum + r.metadata.totalIssuesFound, 0),
    criticalIssues: results.reduce((sum, r) => sum + r.metadata.criticalIssues, 0),
    majorIssues: results.reduce((sum, r) => sum + r.metadata.majorIssues, 0),
    minorIssues: results.reduce((sum, r) => sum + r.metadata.minorIssues, 0),
    issuesByType: {
      overlap: results.reduce((sum, r) => sum + r.metadata.issuesByType.overlap, 0),
      padding: results.reduce((sum, r) => sum + r.metadata.issuesByType.padding, 0),
      spacing: results.reduce((sum, r) => sum + r.metadata.issuesByType.spacing, 0),
      "container-overflow": results.reduce(
        (sum, r) => sum + r.metadata.issuesByType["container-overflow"],
        0
      ),
      scrollbar: results.reduce((sum, r) => sum + r.metadata.issuesByType.scrollbar, 0),
      layout: results.reduce((sum, r) => sum + r.metadata.issuesByType.layout, 0),
      centering: results.reduce((sum, r) => sum + r.metadata.issuesByType.centering, 0),
      "console-error": results.reduce(
        (sum, r) => sum + r.metadata.issuesByType["console-error"],
        0
      ),
    } as Record<import("./types/issues").IssueType, number>,
  };

  return {
    timestamp: new Date().toISOString(),
    viewport,
    results,
    summary,
    ...(exitedEarly && { exitedEarly }),
  };
};

/**
 * Save results to file or output to console
 */
const outputResults = async (
  results: import("./types/issues").AuditResult,
  savePath?: string
): Promise<void> => {
  if (savePath) {
    // Create directory if it doesn't exist
    const directory = path.dirname(savePath);
    await fs.mkdir(directory, { recursive: true });

    // Write results to file
    await fs.writeFile(savePath, JSON.stringify(results, null, 2), "utf8");
  } else {
    process.stdout.write(JSON.stringify(results, null, 2));
  }
};

/**
 * Main entry point for the visual-dom-auditor CLI
 */
const main = async (): Promise<number> => {
  const cliResult = parseCli();

  if (cliResult.err) {
    console.error(`Error: ${cliResult.val.message}`);
    return 1;
  }

  const config = cliResult.val;

  try {
    // Handle single URL case (backwards compatibility)
    if (config.urls.length === 1) {
      return await processSingleUrl(config);
    }

    // Handle multiple URLs case
    return await processMultipleUrls(config);
  } catch (error) {
    console.error(
      "An unexpected error occurred:",
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
};

/**
 * Process a single URL (backwards compatibility)
 */
const processSingleUrl = async (config: import("./types/config").Config): Promise<number> => {
  // Create a console error detector to capture errors during page load
  const { ConsoleErrorDetector } = await import("./core/detectors/console-error");
  const consoleDetector = new ConsoleErrorDetector();

  // Launch browser and prepare page with console error detection
  const prepareResult = await preparePage(config, consoleDetector);

  if (prepareResult.err) {
    console.error(`Error: ${prepareResult.val.message}`);
    return 1;
  }

  const { browser, page } = prepareResult.val;

  try {
    // Run all detectors and collect results
    const counters = await runDetectors(page, consoleDetector);

    // Create audit result
    const auditResult = createSingleUrlAuditResult(config.urls[0], config.viewport, counters);

    // Validate results
    if (!validateResult(auditResult)) {
      console.error("Error: Generated invalid results structure");
      return 1;
    }

    // Output results
    await outputResults(auditResult, config.savePath);

    return 0;
  } finally {
    // Always close the browser
    await closeBrowser(browser);
  }
};

/**
 * Process multiple URLs sequentially with shared browser instance
 */
const processMultipleUrls = async (config: import("./types/config").Config): Promise<number> => {
  // Launch browser once for all URLs
  const browser = await chromium.launch({ headless: true });
  const results: import("./types/issues").SingleUrlAuditResult[] = [];
  let exitedEarly = false;

  try {
    // Create a console error detector
    const { ConsoleErrorDetector } = await import("./core/detectors/console-error");

    // Process each URL sequentially
    for (const url of config.urls) {
      const consoleDetector = new ConsoleErrorDetector();

      // Prepare page for this URL
      const pageResult = await preparePageForUrl(browser, url, config.viewport, consoleDetector);

      if (pageResult.err) {
        console.error(`Error processing ${url}: ${pageResult.val.message}`);

        // If exit early is enabled, stop processing and return results
        if (config.exitEarly) {
          exitedEarly = true;
          break;
        }

        // Otherwise, continue with next URL
        continue;
      }

      const page = pageResult.val;

      try {
        // Run all detectors and collect results
        const counters = await runDetectors(page, consoleDetector);

        // Create audit result for this URL
        const urlResult = createSingleUrlAuditResult(url, config.viewport, counters);
        results.push(urlResult);

        // Check for early exit on critical issues
        if (config.exitEarly && hasCriticalIssues(counters)) {
          exitedEarly = true;
          await page.close();
          break;
        }
      } finally {
        // Close the page but keep browser open for next URL
        await page.close();
      }
    }

    // Create multi-URL audit result
    const multiUrlResult = createMultiUrlAuditResult(config.viewport, results, exitedEarly);

    // Validate results
    if (!validateResult(multiUrlResult)) {
      console.error("Error: Generated invalid results structure");
      return 1;
    }

    // Output results
    await outputResults(multiUrlResult, config.savePath);

    return 0;
  } finally {
    // Always close the browser
    await closeBrowser(browser);
  }
};

// Only run the main function if not in a testing environment
if (process.env.NODE_ENV !== "test") {
  (async () => {
    try {
      const exitCode = await main();
      process.exit(exitCode);
    } catch (error) {
      console.error("Fatal error:", error);
      process.exit(1);
    }
  })();
}

// Export for testing purposes
export { main };
