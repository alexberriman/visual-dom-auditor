#!/usr/bin/env node

import { parseCli } from "./cli";
import { preparePage, closeBrowser } from "./core/browser";
import { validateResult } from "./core/analyzer";
import { promises as fs } from "node:fs";
import path from "node:path";
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
      centering: 0,
      "flex-grid": 0, // This may be mapped to "layout" in the code
    },
  };
};

/**
 * Run all detectors on the page
 */
const runDetectors = async (page: import("playwright-core").Page): Promise<IssueCounters> => {
  const counters = initializeIssueCounters();

  // Import individual detectors
  const { detectors } = await import("./core/detectors");

  // Run each detector separately to prevent one failure from stopping everything
  for (const [name, detector] of Object.entries(detectors)) {
    try {
      console.log(`Running ${name} detector...`);

      const result = await detector.detect(page);

      if (result.ok && result.val.length > 0) {
        console.log(`- Found ${result.val.length} issues with ${name} detector`);

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
 * Create audit result from issue counters
 */
const createAuditResult = (
  config: import("./types/config").Config,
  counters: IssueCounters
): import("./types/issues").AuditResult => {
  return {
    url: config.url,
    timestamp: new Date().toISOString(),
    viewport: config.viewport,
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
        centering: counters.issuesByType.centering || 0,
      },
    },
  };
};

/**
 * Save results to file or output to console
 */
const outputResults = async (
  results: import("./types/issues").AuditResult,
  savePath?: string
): Promise<void> => {
  console.log("Analysis complete!");
  console.log(`Found ${results.metadata.totalIssuesFound} issues.`);

  if (savePath) {
    console.log(`Saving results to ${savePath}`);
    // Create directory if it doesn't exist
    const directory = path.dirname(savePath);
    await fs.mkdir(directory, { recursive: true });

    // Write results to file
    await fs.writeFile(savePath, JSON.stringify(results, null, 2), "utf8");
  } else {
    console.log(JSON.stringify(results, null, 2));
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
    console.log(`Starting analysis of ${config.url}`);
    console.log(`Using viewport: ${config.viewport.width}x${config.viewport.height}`);

    // Launch browser and prepare page
    const prepareResult = await preparePage(config);

    if (prepareResult.err) {
      console.error(`Error: ${prepareResult.val.message}`);
      return 1;
    }

    const { browser, page } = prepareResult.val;

    try {
      console.log("Page prepared successfully. Running analysis...");
      console.log("Running detectors individually for stability...");

      // Run all detectors and collect results
      const counters = await runDetectors(page);

      // Create audit result
      const auditResult = createAuditResult(config, counters);

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
  } catch (error) {
    console.error(
      "An unexpected error occurred:",
      error instanceof Error ? error.message : String(error)
    );
    return 1;
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
