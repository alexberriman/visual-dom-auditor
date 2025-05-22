import { type Page } from "playwright-core";
import { type Detector } from "../analyzer";
import { Ok, type Result } from "../../types/ts-results";
import type { ElementLocation, ScrollbarIssue } from "../../types/issues";
import logger from "../../utils/logger";

type ScrollbarError = {
  message: string;
  cause?: unknown;
};

interface ScrollbarInfo {
  direction: "horizontal" | "vertical";
  viewport: {
    width: number;
    height: number;
  };
  documentSize: {
    width: number;
    height: number;
  };
  causingElement?: {
    selector: string;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

/**
 * DOM script to detect unexpected scrollbars and the elements causing them
 * This function runs in the browser context, so all dependencies must be included
 */
const detectScrollbarsScript = (): unknown => {
  // Helper functions defined in browser context for page.evaluate
  const isElementVisible = (element: Element): boolean => {
    try {
      const style = window.getComputedStyle(element);
      return !(
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        parseFloat(style.opacity) === 0
      );
    } catch {
      return false;
    }
  };

  const getElementSelector = (element: Element): string => {
    try {
      if (element.id) {
        return "#" + element.id;
      }

      let selector = element.tagName.toLowerCase();
      if (element.className && typeof element.className === "string") {
        const classes = element.className.trim().split(/\s+/).slice(0, 2);
        if (classes.length > 0 && classes[0]) {
          selector += "." + classes.join(".");
        }
      }

      return selector;
    } catch {
      return element.tagName ? element.tagName.toLowerCase() : "unknown-element";
    }
  };

  const detectCausingElement = (scrollbar: {
    direction: string;
    viewport: { width: number; height: number };
    documentSize: { width: number; height: number };
    causingElement?: {
      selector: string;
      bounds: { x: number; y: number; width: number; height: number };
    };
  }): void => {
    try {
      const viewportWidth = scrollbar.viewport.width;
      const potentialCulprits: Array<{ element: Element; overhang: number }> = [];
      const checkElements = [
        "body > *",
        ".container > *",
        ".wrapper > *",
        "main > *",
        "#content > *",
      ];

      for (const selector of checkElements) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of Array.from(elements)) {
            if (!isElementVisible(element)) continue;

            const rect = element.getBoundingClientRect();
            const elementRight = rect.left + rect.width;

            if (elementRight > viewportWidth && rect.width > 50) {
              const overhang = elementRight - viewportWidth;
              potentialCulprits.push({ element, overhang });
            }
          }
        } catch {
          continue;
        }
      }

      if (potentialCulprits.length > 0) {
        potentialCulprits.sort((a, b) => b.overhang - a.overhang);
        const culprit = potentialCulprits[0];
        const rect = culprit.element.getBoundingClientRect();

        scrollbar.causingElement = {
          selector: getElementSelector(culprit.element),
          bounds: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
        };
      }
    } catch {
      // If detection fails, continue without causing element info
    }
  };

  // Main scrollbar detection logic
  const checkScrollbars = (): Array<{
    direction: "horizontal" | "vertical";
    viewport: { width: number; height: number };
    documentSize: { width: number; height: number };
    causingElement?: {
      selector: string;
      bounds: { x: number; y: number; width: number; height: number };
    };
  }> => {
    const scrollbars: Array<{
      direction: "horizontal" | "vertical";
      viewport: { width: number; height: number };
      documentSize: { width: number; height: number };
      causingElement?: {
        selector: string;
        bounds: { x: number; y: number; width: number; height: number };
      };
    }> = [];

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const documentSize = {
      width: Math.max(
        document.documentElement.scrollWidth,
        document.documentElement.offsetWidth,
        document.documentElement.clientWidth,
        document.body ? document.body.scrollWidth : 0,
        document.body ? document.body.offsetWidth : 0
      ),
      height: Math.max(
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight,
        document.body ? document.body.scrollHeight : 0,
        document.body ? document.body.offsetHeight : 0
      ),
    };

    if (documentSize.width > viewport.width) {
      const horizontalScrollbar = {
        direction: "horizontal" as const,
        viewport,
        documentSize,
      };
      detectCausingElement(horizontalScrollbar);
      scrollbars.push(horizontalScrollbar);
    }

    if (documentSize.height > viewport.height + 100) {
      const verticalScrollbar = {
        direction: "vertical" as const,
        viewport,
        documentSize,
      };
      scrollbars.push(verticalScrollbar);
    }

    return scrollbars;
  };

  try {
    return checkScrollbars();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error during scrollbar detection",
    };
  }
};

/**
 * Detector for unexpected scrollbars
 */
export class ScrollbarDetector implements Detector {
  private ignoredSelectors: string[];

  constructor(options: { ignoredSelectors?: string[]; expectVerticalScrollbar?: boolean } = {}) {
    this.ignoredSelectors = options.ignoredSelectors || [];
    // expectVerticalScrollbar option is available but not used in current implementation
    // (vertical scrollbars are generally expected and not reported as issues)
  }

  private shouldIgnoreElement(selector: string): boolean {
    return this.ignoredSelectors.some((ignored) => selector.includes(ignored));
  }

  private createScrollbarIssue(scrollbarInfo: ScrollbarInfo): ScrollbarIssue {
    const overflowAmount = scrollbarInfo.documentSize.width - scrollbarInfo.viewport.width;

    const elements: ElementLocation[] = [];
    if (scrollbarInfo.causingElement) {
      elements.push({
        selector: scrollbarInfo.causingElement.selector,
        x: scrollbarInfo.causingElement.bounds.x,
        y: scrollbarInfo.causingElement.bounds.y,
        width: scrollbarInfo.causingElement.bounds.width,
        height: scrollbarInfo.causingElement.bounds.height,
      });
    }

    const severity = overflowAmount > 100 ? "critical" : overflowAmount > 20 ? "major" : "minor";
    const message = scrollbarInfo.causingElement
      ? `Horizontal scrollbar caused by ${scrollbarInfo.causingElement.selector} extending ${overflowAmount}px beyond viewport`
      : `Unexpected horizontal scrollbar detected (content extends ${overflowAmount}px beyond viewport)`;

    return {
      type: "scrollbar",
      severity,
      message,
      elements,
      direction: scrollbarInfo.direction,
      causingElement: scrollbarInfo.causingElement
        ? {
            selector: scrollbarInfo.causingElement.selector,
            x: scrollbarInfo.causingElement.bounds.x,
            y: scrollbarInfo.causingElement.bounds.y,
            width: scrollbarInfo.causingElement.bounds.width,
            height: scrollbarInfo.causingElement.bounds.height,
          }
        : undefined,
    };
  }

  async detect(page: Page): Promise<Result<ScrollbarIssue[], ScrollbarError>> {
    try {
      const result = await page.evaluate(detectScrollbarsScript);

      if (result && typeof result === "object" && "error" in result) {
        logger.warn("Could not detect scrollbar issues - skipping", {
          data: [{ name: "TypeError", message: result.error }],
        });
        return Ok([]);
      }

      if (!Array.isArray(result)) {
        logger.warn("Could not detect scrollbar issues - skipping", {
          data: [{ name: "TypeError", message: "Invalid result format" }],
        });
        return Ok([]);
      }

      const scrollbarInfos = result as ScrollbarInfo[];
      const issues: ScrollbarIssue[] = [];

      for (const scrollbarInfo of scrollbarInfos) {
        if (scrollbarInfo.direction === "horizontal") {
          // Skip if causing element matches ignored selectors
          if (
            scrollbarInfo.causingElement &&
            this.shouldIgnoreElement(scrollbarInfo.causingElement.selector)
          ) {
            continue;
          }

          issues.push(this.createScrollbarIssue(scrollbarInfo));
        }
      }

      return Ok(issues);
    } catch (error) {
      logger.warn("Could not detect scrollbar issues - skipping", {
        data: [
          {
            name: error instanceof Error ? error.constructor.name : "Error",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      });
      return Ok([]);
    }
  }
}

export default new ScrollbarDetector();
