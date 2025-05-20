#!/usr/bin/env node

import { parseCli } from "./cli";
import { preparePage, closeBrowser } from "./core/browser";
import { analyzePage, validateResult } from "./core/analyzer";
import { promises as fs } from "node:fs";
import path from "node:path";
import allDetectors from "./core/detectors";

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

      // Run analysis with all implemented detectors
      const analysisResult = await analyzePage(page, config, allDetectors);

      if (analysisResult.err) {
        console.error(`Analysis error: ${analysisResult.val.message}`);
        return 1;
      }

      const results = analysisResult.val;

      // Validate results
      if (!validateResult(results)) {
        console.error("Error: Generated invalid results structure");
        return 1;
      }

      console.log("Analysis complete!");
      console.log(`Found ${results.metadata.totalIssuesFound} issues.`);

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
