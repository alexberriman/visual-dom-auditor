import { type Page } from "playwright-core";
import { type Detector } from "../analyzer";
import { Ok, Err, type Result } from "../../types/ts-results";
import type { ConsoleErrorIssue } from "../../types/issues";

type ConsoleErrorDetectorError = {
  message: string;
  cause?: unknown;
};

/**
 * Console message from browser
 */
interface ConsoleMessage {
  type: "error" | "warning" | "info" | "log";
  text: string;
  url?: string;
  line?: number;
  column?: number;
  stackTrace?: string;
}

/**
 * Detector for console errors and warnings
 */
export class ConsoleErrorDetector implements Detector {
  private consoleMessages: ConsoleMessage[] = [];
  private isListening = false;

  constructor(
    private options: {
      includeWarnings?: boolean;
      maxMessages?: number;
      ignorePatterns?: string[];
    } = {}
  ) {
    this.options = {
      includeWarnings: options.includeWarnings ?? true,
      maxMessages: options.maxMessages ?? 50,
      ignorePatterns: options.ignorePatterns ?? [
        // Common false positives
        "favicon.ico",
        "robots.txt",
        "sw.js",
        "service-worker",
        "chrome-extension://",
        "moz-extension://",
        // Development tools
        "webpack",
        "hot-reload",
        "livereload",
        // Third-party analytics that commonly have benign errors
        "googletagmanager",
        "google-analytics",
        "gtag",
        "facebook.net",
        "doubleclick.net",
      ],
    };
  }

  /**
   * Start listening for console messages
   */
  private startListening(page: Page): void {
    if (this.isListening) return;

    this.consoleMessages = [];
    this.isListening = true;

    page.on("console", (msg) => {
      if (this.consoleMessages.length >= (this.options.maxMessages || 50)) {
        return;
      }

      const type = msg.type() as "error" | "warning" | "info" | "log";

      // Only capture errors and warnings (if enabled)
      if (type !== "error" && (type !== "warning" || !this.options.includeWarnings)) {
        return;
      }

      const text = msg.text();
      const location = msg.location();

      // Skip messages matching ignore patterns
      if (this.shouldIgnoreMessage(text, location.url)) {
        return;
      }

      this.consoleMessages.push({
        type,
        text,
        url: location.url,
        line: location.lineNumber,
        column: location.columnNumber,
      });
    });

    // Also listen for page errors (uncaught exceptions)
    page.on("pageerror", (error) => {
      if (this.consoleMessages.length >= (this.options.maxMessages || 50)) {
        return;
      }

      const text = error.message;

      if (this.shouldIgnoreMessage(text)) {
        return;
      }

      this.consoleMessages.push({
        type: "error",
        text,
        stackTrace: error.stack,
      });
    });
  }

  /**
   * Stop listening for console messages
   */
  private stopListening(page: Page): void {
    if (!this.isListening) return;

    page.removeAllListeners("console");
    page.removeAllListeners("pageerror");
    this.isListening = false;
  }

  /**
   * Check if a console message should be ignored
   */
  private shouldIgnoreMessage(text: string, url?: string): boolean {
    const message = text.toLowerCase();
    const sourceUrl = url?.toLowerCase() || "";

    return (this.options.ignorePatterns || []).some((pattern) => {
      const lowerPattern = pattern.toLowerCase();
      return message.includes(lowerPattern) || sourceUrl.includes(lowerPattern);
    });
  }

  /**
   * Determine severity based on console message type and content
   */
  private determineSeverity(message: ConsoleMessage): "critical" | "major" | "minor" {
    // JavaScript errors are generally critical
    if (message.type === "error") {
      // Network errors or missing resources are major
      if (
        message.text.includes("Failed to load resource") ||
        message.text.includes("404") ||
        message.text.includes("net::ERR")
      ) {
        return "major";
      }

      // Syntax errors, type errors, and reference errors are critical
      if (
        message.text.includes("SyntaxError") ||
        message.text.includes("TypeError") ||
        message.text.includes("ReferenceError") ||
        message.text.includes("Uncaught")
      ) {
        return "critical";
      }

      return "major";
    }

    // Warnings are generally minor unless they indicate serious issues
    if (message.type === "warning") {
      // Check for specific deprecated API usage (should be major)
      if (message.text.toLowerCase().includes("deprecated")) {
        return "major";
      }

      // Security-related warnings are major
      if (
        message.text.toLowerCase().includes("security") ||
        message.text.toLowerCase().includes("unsafe")
      ) {
        return "major";
      }
      return "minor";
    }

    return "minor";
  }

  /**
   * Create a formatted message for the issue
   */
  private createIssueMessage(message: ConsoleMessage): string {
    const prefix = message.type === "error" ? "Console Error:" : "Console Warning:";
    const location =
      message.url && message.line ? ` (${message.url}:${message.line}:${message.column || 0})` : "";

    return `${prefix} ${message.text}${location}`;
  }

  /**
   * Convert console message to ConsoleErrorIssue
   */
  private createConsoleErrorIssue(message: ConsoleMessage): ConsoleErrorIssue {
    return {
      type: "console-error",
      severity: this.determineSeverity(message),
      message: this.createIssueMessage(message),
      elements: [], // Console errors don't have associated DOM elements
      level: message.type as "error" | "warning",
      source: {
        url: message.url,
        line: message.line,
        column: message.column,
      },
      stackTrace: message.stackTrace,
    };
  }

  /**
   * Detect console errors and warnings on the page
   */
  async detect(page: Page): Promise<Result<ConsoleErrorIssue[], ConsoleErrorDetectorError>> {
    try {
      // Start listening for console messages
      this.startListening(page);

      // Wait a short time to collect initial console messages
      // This catches errors that occur during page load
      await page.waitForTimeout(1000);

      // Stop listening
      this.stopListening(page);

      // Convert console messages to issues
      const issues = this.consoleMessages.map((message) => this.createConsoleErrorIssue(message));

      // Sort by severity (critical first, then major, then minor)
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return Ok(issues);
    } catch (error) {
      return Err({
        message: "Failed to detect console errors",
        cause: error,
      });
    }
  }
}

export default new ConsoleErrorDetector();
