import { spinner } from "./spinner";
import type { SpinnerOptions } from "./spinner";

/**
 * Context-aware spinner that captures URL context at creation time
 * This prevents race conditions when multiple operations run concurrently
 */
export class ContextSpinner {
  private readonly urlContext: string | null;

  constructor(urlContext: string | null = null) {
    this.urlContext = urlContext;
  }

  start(message: string, options?: SpinnerOptions): void {
    // Temporarily set the context for this operation
    const previousContext = spinner.getUrlContext();
    spinner.setUrlContext(this.urlContext);
    spinner.start(message, options);
    // Restore previous context
    spinner.setUrlContext(previousContext);
  }

  update(message: string): void {
    const previousContext = spinner.getUrlContext();
    spinner.setUrlContext(this.urlContext);
    spinner.update(message);
    spinner.setUrlContext(previousContext);
  }

  succeed(message: string): void {
    const previousContext = spinner.getUrlContext();
    spinner.setUrlContext(this.urlContext);
    spinner.succeed(message);
    spinner.setUrlContext(previousContext);
  }

  fail(message: string): void {
    const previousContext = spinner.getUrlContext();
    spinner.setUrlContext(this.urlContext);
    spinner.fail(message);
    spinner.setUrlContext(previousContext);
  }

  warn(message: string): void {
    const previousContext = spinner.getUrlContext();
    spinner.setUrlContext(this.urlContext);
    spinner.warn(message);
    spinner.setUrlContext(previousContext);
  }

  clear(): void {
    spinner.clear();
  }

  /**
   * Static method to create a new context spinner
   */
  static create(urlContext: string | null = null): ContextSpinner {
    return new ContextSpinner(urlContext);
  }
}
