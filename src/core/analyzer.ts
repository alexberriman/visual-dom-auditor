import { type Page } from "playwright-core";
import { Ok, Err, type Result } from "../types/ts-results";
import type { AuditResult, Issue, IssueType } from "../types/issues";
import type { Config } from "../types/config";

/**
 * Error type for analyzer operations
 */
type AnalyzerError = {
  message: string;
  cause?: unknown;
};

/**
 * Detector module interface
 */
export interface Detector {
  /**
   * Runs the detector on the page
   * @param page The Playwright page to analyze
   * @returns A result containing found issues or an error
   */
  detect: (_page: Page) => Promise<Result<Issue[], AnalyzerError>>;
}

/**
 * Analyze a page for layout issues
 *
 * @param page The prepared Playwright page to analyze
 * @param config The CLI configuration
 * @param detectors The detector modules to run
 * @returns A result containing the audit result or an error
 */
export const analyzePage = async (
  page: Page,
  config: Config,
  detectors: Detector[]
): Promise<Result<AuditResult, AnalyzerError>> => {
  try {
    const allIssues: Issue[] = [];

    // Run each detector sequentially
    for (const detector of detectors) {
      const result = await detector.detect(page);

      if (result.err) {
        return Err(result.val);
      }

      allIssues.push(...result.val);
    }

    // Generate metadata
    const criticalIssues = allIssues.filter((issue) => issue.severity === "critical").length;
    const majorIssues = allIssues.filter((issue) => issue.severity === "major").length;
    const minorIssues = allIssues.filter((issue) => issue.severity === "minor").length;

    // Initialize issues count object with all issue types
    const issuesByType: Record<IssueType, number> = {
      overlap: 0,
      padding: 0,
      spacing: 0,
      "container-overflow": 0,
      scrollbar: 0,
      layout: 0,
      centering: 0, // Disabled by default due to false positives
    };

    // Count issues by type
    for (const issue of allIssues) {
      const type = issue.type;
      issuesByType[type] += 1;
    }

    // Create the audit result
    const auditResult: AuditResult = {
      url: config.url,
      timestamp: new Date().toISOString(),
      viewport: config.viewport,
      issues: allIssues,
      metadata: {
        totalIssuesFound: allIssues.length,
        criticalIssues,
        majorIssues,
        minorIssues,
        issuesByType,
      },
    };

    return Ok(auditResult);
  } catch (error) {
    return Err({
      message: "Failed to analyze page",
      cause: error,
    });
  }
};

/**
 * Validate the audit result
 *
 * This function validates that the audit result has the expected structure.
 * In a real implementation, this would use Zod or another validation library.
 *
 * @param result The audit result to validate
 * @returns True if valid, false otherwise
 */
export const validateResult = (result: AuditResult): boolean => {
  // Basic validation - in a real implementation, this would use Zod
  return !(
    !result.url ||
    !result.timestamp ||
    !result.viewport ||
    !Array.isArray(result.issues) ||
    !result.metadata
  );
};
