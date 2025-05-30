import { type Page } from "playwright-core";
import { Ok, Err, type Result } from "../types/ts-results";
import type {
  AuditResult,
  SingleUrlAuditResult,
  MultiUrlAuditResult,
  CrawlAuditResult,
  Issue,
  IssueType,
} from "../types/issues";

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
 * @param url The URL being analyzed
 * @param viewport The viewport configuration
 * @param detectors The detector modules to run
 * @returns A result containing the audit result or an error
 */
export const analyzePage = async (
  page: Page,
  url: string,
  viewport: { width: number; height: number },
  detectors: Detector[]
): Promise<Result<SingleUrlAuditResult, AnalyzerError>> => {
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
      "console-error": 0,
    };

    // Count issues by type
    for (const issue of allIssues) {
      const type = issue.type;
      issuesByType[type] += 1;
    }

    // Create the audit result
    const auditResult: SingleUrlAuditResult = {
      url,
      timestamp: new Date().toISOString(),
      viewport,
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
 * Validate single URL audit result
 */
const validateSingleUrlResult = (result: SingleUrlAuditResult): boolean => {
  return !(
    !result.url ||
    !result.timestamp ||
    !result.viewport ||
    !Array.isArray(result.issues) ||
    !result.metadata
  );
};

/**
 * Validate multi-URL audit result
 */
const validateMultiUrlResult = (result: MultiUrlAuditResult): boolean => {
  return !(
    !result.timestamp ||
    !result.viewport ||
    !Array.isArray(result.results) ||
    !result.summary ||
    result.results.some((r) => !validateSingleUrlResult(r))
  );
};

/**
 * Validate crawl audit result
 */
const validateCrawlResult = (result: CrawlAuditResult): boolean => {
  return (
    validateMultiUrlResult(result) &&
    !!(
      result.crawlMetadata &&
      result.crawlMetadata.startUrl &&
      typeof result.crawlMetadata.maxDepthReached === "number" &&
      typeof result.crawlMetadata.totalPagesDiscovered === "number" &&
      typeof result.crawlMetadata.pagesSkipped === "number" &&
      typeof result.crawlMetadata.crawlDuration === "number"
    )
  );
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
  // Check if it's a single URL result (has url property)
  if ("url" in result) {
    return validateSingleUrlResult(result as SingleUrlAuditResult);
  }

  // Check if it's a crawl result (has crawlMetadata property)
  if ("crawlMetadata" in result) {
    return validateCrawlResult(result as CrawlAuditResult);
  }

  // Otherwise, it's a multi-URL result (has results property)
  if ("results" in result) {
    return validateMultiUrlResult(result as MultiUrlAuditResult);
  }

  return false;
};
