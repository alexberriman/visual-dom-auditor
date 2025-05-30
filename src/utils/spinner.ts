import ora, { type Ora, type Color, type Spinner } from "ora";
import type { SpinnerName } from "cli-spinners";
import { prefixWithUrl } from "./colors";

/**
 * Spinner utility for showing progress during CLI operations
 * Only shows spinners when output is a TTY (interactive terminal)
 * Automatically handles cleanup and prevents interference with JSON output
 */
class SpinnerManager {
  private currentSpinner: Ora | null = null;
  private shouldShowSpinners: boolean;
  private currentUrl: string | null = null;

  constructor() {
    // Only show spinners in interactive terminals and not during tests
    this.shouldShowSpinners =
      process.stdout.isTTY && process.env.NODE_ENV !== "test" && !process.env.CI;
  }

  /**
   * Set the current URL context for all subsequent spinner messages
   */
  setUrlContext(url: string | null): void {
    this.currentUrl = url;
  }

  /**
   * Start a new spinner with the given text and options
   */
  start(text: string, options?: { color?: Color; spinner?: SpinnerName | Spinner }): void {
    if (!this.shouldShowSpinners) return;

    // Stop any existing spinner
    this.stop();

    const displayText = this.currentUrl ? prefixWithUrl(this.currentUrl, text) : text;
    this.currentSpinner = ora({
      text: displayText,
      color: options?.color || "cyan",
      spinner: options?.spinner || "dots",
    }).start();
  }

  /**
   * Update the text of the current spinner
   */
  update(text: string): void {
    if (!this.shouldShowSpinners || !this.currentSpinner) return;
    const displayText = this.currentUrl ? prefixWithUrl(this.currentUrl, text) : text;
    this.currentSpinner.text = displayText;
  }

  /**
   * Stop the current spinner with a success message
   */
  succeed(text?: string): void {
    if (!this.shouldShowSpinners || !this.currentSpinner) return;

    if (text) {
      const displayText = this.currentUrl ? prefixWithUrl(this.currentUrl, text) : text;
      this.currentSpinner.succeed(displayText);
    } else {
      this.currentSpinner.succeed();
    }
    this.currentSpinner = null;
  }

  /**
   * Stop the current spinner with a failure message
   */
  fail(text?: string): void {
    if (!this.shouldShowSpinners || !this.currentSpinner) return;

    if (text) {
      const displayText = this.currentUrl ? prefixWithUrl(this.currentUrl, text) : text;
      this.currentSpinner.fail(displayText);
    } else {
      this.currentSpinner.fail();
    }
    this.currentSpinner = null;
  }

  /**
   * Stop the current spinner with a warning message
   */
  warn(text?: string): void {
    if (!this.shouldShowSpinners || !this.currentSpinner) return;

    if (text) {
      const displayText = this.currentUrl ? prefixWithUrl(this.currentUrl, text) : text;
      this.currentSpinner.warn(displayText);
    } else {
      this.currentSpinner.warn();
    }
    this.currentSpinner = null;
  }

  /**
   * Stop the current spinner with an info message
   */
  info(text?: string): void {
    if (!this.shouldShowSpinners || !this.currentSpinner) return;

    if (text) {
      const displayText = this.currentUrl ? prefixWithUrl(this.currentUrl, text) : text;
      this.currentSpinner.info(displayText);
    } else {
      this.currentSpinner.info();
    }
    this.currentSpinner = null;
  }

  /**
   * Stop the current spinner without any message
   */
  stop(): void {
    if (!this.shouldShowSpinners || !this.currentSpinner) return;

    this.currentSpinner.stop();
    this.currentSpinner = null;
  }

  /**
   * Clear any active spinner (useful before outputting final results)
   */
  clear(): void {
    if (!this.shouldShowSpinners || !this.currentSpinner) return;

    this.currentSpinner.clear();
    this.currentSpinner = null;
  }

  /**
   * Check if spinners are enabled in this environment
   */
  get isEnabled(): boolean {
    return this.shouldShowSpinners;
  }
}

// Export a singleton instance
export const spinner = new SpinnerManager();

// Also export the class for testing
export { SpinnerManager };
