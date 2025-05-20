#!/usr/bin/env node

import { parseCli } from "./cli";
import { preparePage, closeBrowser } from "./core/browser";
import { promises as fs } from "node:fs";
import path from "node:path";

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

    const { browser } = prepareResult.val;

    try {
      // Placeholder for the actual analysis
      // Will implement detectors in future tasks
      console.log("Page prepared successfully. Ready for analysis.");
      console.log("Analysis complete!");

      // Placeholder for the actual results
      const results = {
        url: config.url,
        timestamp: new Date().toISOString(),
        viewport: config.viewport,
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
          },
        },
      };

      if (config.savePath) {
        console.log(`Saving results to ${config.savePath}`);
        // Create directory if it doesn't exist
        const directory = path.dirname(config.savePath);
        await fs.mkdir(directory, { recursive: true });

        // Write results to file
        await fs.writeFile(config.savePath, JSON.stringify(results, null, 2), "utf8");
      } else {
        console.log(JSON.stringify(results, null, 2));
      }

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

// Run the main function if this file is being executed directly
if (process.argv[1] === import.meta.url) {
  // Using top-level await
  try {
    const exitCode = await main();
    process.exit(exitCode);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Export for testing purposes
export { main };
