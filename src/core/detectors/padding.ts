import { type Page } from "playwright-core";
import { type Detector } from "../analyzer";
import { Ok, Err, type Result } from "../../types/ts-results";
import type { ElementLocation, PaddingIssue } from "../../types/issues";
import logger from "../../utils/logger";

type PaddingError = {
  message: string;
  cause?: unknown;
};

/**
 * Element with padding information
 */
interface ElementWithPadding {
  selector: string;
  tagName: string;
  textContent?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  display: string; // CSS display property
  hasDimensions: {
    width: boolean;
    height: boolean;
  }; // Indicates if element has hardcoded dimensions
  styleInfo: {
    // Explicit styles from attributes or inline
    explicit: {
      width: string | null;
      height: string | null;
      padding: {
        top: string | null;
        right: string | null;
        bottom: string | null;
        left: string | null;
      };
    };
    // Computed styles from browser
    computed: {
      width: string;
      height: string;
      paddingTop: string;
      paddingRight: string;
      paddingBottom: string;
      paddingLeft: string;
      boxSizing: string;
    };
    // Classes that might affect dimension/padding
    classes: string[];
  };
}

/**
 * Determine padding severity based on element type and padding values
 */
const determineSeverity = (
  element: ElementWithPadding,
  insufficientSides: ("top" | "right" | "bottom" | "left")[]
): "critical" | "major" | "minor" => {
  // Critical: No padding on interactive elements or buttons
  if (
    (element.tagName === "button" ||
      element.tagName === "a" ||
      element.tagName.includes("button")) &&
    insufficientSides.length > 1
  ) {
    return "critical";
  }

  // Major: Very low padding on important elements
  if (
    insufficientSides.length >= 3 ||
    (element.padding.top === 0 && element.padding.bottom === 0) ||
    (element.padding.left === 0 && element.padding.right === 0)
  ) {
    return "major";
  }

  // Minor: Some padding issues but not as severe
  return "minor";
};

/**
 * List of interactive elements that should have padding
 */
const INTERACTIVE_SELECTORS = [
  "button",
  "a.button",
  "a.btn",
  "[role=button]",
  ".button",
  ".btn",
  "input[type=button]",
  "input[type=submit]",
  "input[type=reset]",
  "select",
  "nav a",
  ".nav-item",
  ".menu-item",
  ".card",
  ".card-header",
  ".card-body",
  ".card-footer",
  "form",
  "fieldset",
  ".form-group",
  ".form-control",
  ".input-group",
].join(",");

/**
 * Get interactive elements with padding information
 */
const getElementsWithPadding = async (
  page: Page
): Promise<Result<ElementWithPadding[], PaddingError>> => {
  try {
    // Get all interactive elements that should have padding
    const elements = await page.evaluate((selectors) => {
      const elementsWithPadding = [];

      // Query the elements
      const allElements = document.querySelectorAll(selectors);

      // Create array from NodeList for iteration
      const domElements = Array.from(allElements);

      // Helper function to check if element should be skipped
      function shouldSkipElement(
        element: Element,
        rect: DOMRect,
        styles: CSSStyleDeclaration
      ): boolean {
        // Skip elements with zero size
        if (rect.width === 0 || rect.height === 0) {
          return true;
        }

        // Skip hidden elements
        if (
          styles.display === "none" ||
          styles.visibility === "hidden" ||
          styles.opacity === "0" ||
          (element.hasAttribute("aria-hidden") && element.getAttribute("aria-hidden") === "true")
        ) {
          return true;
        }

        // Skip links with display:inline - they don't need padding
        if (element.tagName.toLowerCase() === "a" && styles.display === "inline") {
          return true;
        }

        return false;
      }

      // Helper function to process Tailwind width classes
      function checkTailwindWidthClasses(classes: string[]): boolean {
        return classes.some((cls) => {
          return (
            /^w-\d+$/.test(cls) || // w-0, w-1, w-2, w-10, etc.
            /^w-\d+\/\d+$/.test(cls) || // w-1/2, w-3/4, etc.
            /^w-\[.+\]$/.test(cls) || // w-[custom]
            cls === "w-auto" ||
            cls === "w-full" ||
            cls === "w-screen" ||
            cls === "w-min" ||
            cls === "w-max" ||
            cls === "w-fit" ||
            /^size-\d+$/.test(cls) || // size-6 (sets both width and height)
            /^size-\[.+\]$/.test(cls) || // size-[custom]
            cls.startsWith("px-")
          );
        });
      }

      // Helper function to process Tailwind height classes
      function checkTailwindHeightClasses(classes: string[]): boolean {
        return classes.some((cls) => {
          return (
            /^h-\d+$/.test(cls) || // h-0, h-1, h-2, h-10, etc.
            /^h-\d+\/\d+$/.test(cls) || // h-1/2, h-3/4, etc.
            /^h-\[.+\]$/.test(cls) || // h-[custom]
            cls === "h-auto" ||
            cls === "h-full" ||
            cls === "h-screen" ||
            cls === "h-min" ||
            cls === "h-max" ||
            cls === "h-fit" ||
            /^size-\d+$/.test(cls) || // size sets both width and height
            /^size-\[.+\]$/.test(cls) || // size-[custom]
            cls.startsWith("py-")
          );
        });
      }

      // Process each element
      for (const [index, element] of domElements.entries()) {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        // Skip elements that should be ignored
        if (shouldSkipElement(element, rect, styles)) {
          continue;
        }

        // Generate a unique selector for this element
        const selector = generateSelector(element, index);

        // Get padding information
        const padding = {
          top: parseInt(styles.paddingTop, 10),
          right: parseInt(styles.paddingRight, 10),
          bottom: parseInt(styles.paddingBottom, 10),
          left: parseInt(styles.paddingLeft, 10),
        };

        // Process text content
        const textContent = element.textContent ? element.textContent.trim() : "";
        const truncatedText =
          textContent.length > 50 ? textContent.substring(0, 47) + "..." : textContent;

        // Collect detailed style information
        const styleInfo = {
          explicit: {
            width: element.hasAttribute("width") ? element.getAttribute("width") : null,
            height: element.hasAttribute("height") ? element.getAttribute("height") : null,
            padding: {
              top: null,
              right: null,
              bottom: null,
              left: null,
            },
          },
          computed: {
            width: styles.width,
            height: styles.height,
            paddingTop: styles.paddingTop,
            paddingRight: styles.paddingRight,
            paddingBottom: styles.paddingBottom,
            paddingLeft: styles.paddingLeft,
            boxSizing: styles.boxSizing,
          },
          classes: Array.from(element.classList),
        };

        const tailwindClasses = Array.from(element.classList);
        const hasTailwindWidth = checkTailwindWidthClasses(tailwindClasses);
        const hasTailwindHeight = checkTailwindHeightClasses(tailwindClasses);

        // Element has explicit dimensions if set via attributes or Tailwind classes
        const hasExplicitWidth = element.hasAttribute("width") || hasTailwindWidth;
        const hasExplicitHeight = element.hasAttribute("height") || hasTailwindHeight;

        const hasDimensions = {
          width: hasExplicitWidth,
          height: hasExplicitHeight,
        };

        elementsWithPadding.push({
          selector,
          tagName: element.tagName.toLowerCase(),
          textContent: truncatedText || undefined, // Only include if non-empty
          bounds: {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
          },
          padding,
          display: styles.display,
          hasDimensions,
          styleInfo,
        });
      }

      function generateSelector(
        element: { id: string; tagName: string; classList: DOMTokenList },
        index: number
      ): string {
        // Try to get id
        if (element.id) {
          return `#${element.id}`;
        }

        // Build path from element tag names
        let selector = element.tagName.toLowerCase();

        // Add class names (up to 2)
        const classList = Array.from(element.classList).slice(0, 2);
        if (classList.length > 0) {
          selector += `.${classList.join(".")}`;
        }

        // Add a data attribute to help identify it
        return selector + `[data-vda-index="${index}"]`;
      }

      return elementsWithPadding;
    }, INTERACTIVE_SELECTORS);

    return Ok(elements || []);
  } catch (error) {
    // Only log errors if not in test environment
    if (process.env.NODE_ENV !== "test") {
      console.error("Error fetching elements:", error);
    }
    return Err({
      message: "Failed to get elements with padding",
      cause: error,
    });
  }
};

/**
 * Detector for elements with insufficient padding
 */
export class PaddingDetector implements Detector {
  // Configuration options
  private minimumPaddingPx: number;
  private ignoredSelectors: string[];
  private strictElementSelectors: string[];

  constructor(
    options: {
      minimumPaddingPx?: number;
      ignoredSelectors?: string[];
      strictElementSelectors?: string[];
    } = {}
  ) {
    // Default minimum padding is 8px - below that is often too cramped for interactive elements
    this.minimumPaddingPx = options.minimumPaddingPx ?? 8;

    // Default ignored selectors
    this.ignoredSelectors = options.ignoredSelectors ?? [
      ".nav-icon",
      ".icon",
      ".badge",
      ".close",
      "[aria-hidden=true]",
      ".dropdown-toggle",
    ];

    // Elements that should have stricter padding requirements
    this.strictElementSelectors = options.strictElementSelectors ?? [
      "button",
      "input[type=button]",
      "input[type=submit]",
      ".btn",
      ".button",
    ];
  }

  /**
   * Check if a selector should be ignored
   */
  private shouldIgnoreElement(selector: string): boolean {
    return this.ignoredSelectors.some((ignored) => selector.includes(ignored));
  }

  /**
   * Check if an element should have stricter padding requirements
   */
  private hasStricterRequirements(selector: string): boolean {
    return this.strictElementSelectors.some((strict) => selector.toLowerCase().includes(strict));
  }

  /**
   * Check element for insufficient padding and create an issue if needed
   */
  private checkElementPadding(element: ElementWithPadding): PaddingIssue | null {
    // Skip elements that should be ignored
    if (this.shouldSkipElement(element)) {
      return null;
    }

    // Determine the minimum padding required and check for insufficient sides
    const requiredPadding = this.getRequiredPadding(element);
    const insufficientSides = this.findInsufficientSides(element, requiredPadding);

    // Log skipped sides
    this.logSkippedSides(element, requiredPadding);

    // Only create issues if there are insufficient sides
    if (insufficientSides.length === 0) {
      return null;
    }

    // Create and return the issue
    return this.createPaddingIssue(element, insufficientSides);
  }

  /**
   * Check if an element should be skipped
   */
  private shouldSkipElement(element: ElementWithPadding): boolean {
    // Skip ignored elements
    if (this.shouldIgnoreElement(element.selector)) {
      logger.debug(`Ignoring element ${element.selector} - in ignore list`);
      return true;
    }

    // Skip links with display:inline as they don't need padding
    if (element.tagName === "a" && element.display === "inline") {
      logger.debug(`Ignoring element ${element.selector} - inline link`);
      return true;
    }

    return false;
  }

  /**
   * Get the required padding for an element
   */
  private getRequiredPadding(element: ElementWithPadding): number {
    return this.hasStricterRequirements(element.selector)
      ? this.minimumPaddingPx * 1.5 // More padding for important elements
      : this.minimumPaddingPx;
  }

  /**
   * Find sides with insufficient padding
   */
  private findInsufficientSides(
    element: ElementWithPadding,
    requiredPadding: number
  ): ("top" | "right" | "bottom" | "left")[] {
    const insufficientSides: ("top" | "right" | "bottom" | "left")[] = [];

    // Get tailwind padding classes
    const hasTailwindPadding = this.getTailwindPaddingClasses(element);

    // Check each side for insufficient padding
    this.checkSidePadding(element, "top", requiredPadding, hasTailwindPadding, insufficientSides);
    this.checkSidePadding(element, "right", requiredPadding, hasTailwindPadding, insufficientSides);
    this.checkSidePadding(
      element,
      "bottom",
      requiredPadding,
      hasTailwindPadding,
      insufficientSides
    );
    this.checkSidePadding(element, "left", requiredPadding, hasTailwindPadding, insufficientSides);

    return insufficientSides;
  }

  /**
   * Get Tailwind padding classes for all sides
   */
  private getTailwindPaddingClasses(element: ElementWithPadding): Record<string, boolean> {
    return {
      top: element.styleInfo.classes.some(
        (cls) => cls.startsWith("pt-") || cls.startsWith("py-") || cls.startsWith("p-")
      ),
      right: element.styleInfo.classes.some(
        (cls) => cls.startsWith("pr-") || cls.startsWith("px-") || cls.startsWith("p-")
      ),
      bottom: element.styleInfo.classes.some(
        (cls) => cls.startsWith("pb-") || cls.startsWith("py-") || cls.startsWith("p-")
      ),
      left: element.styleInfo.classes.some(
        (cls) => cls.startsWith("pl-") || cls.startsWith("px-") || cls.startsWith("p-")
      ),
    };
  }

  /**
   * Check if a side has insufficient padding and add to the list if it does
   */
  private checkSidePadding(
    element: ElementWithPadding,
    side: "top" | "right" | "bottom" | "left",
    requiredPadding: number,
    hasTailwindPadding: Record<string, boolean>,
    insufficientSides: ("top" | "right" | "bottom" | "left")[]
  ): void {
    const isVertical = side === "top" || side === "bottom";
    const dimensionProperty = isVertical ? "height" : "width";

    if (
      element.padding[side] < requiredPadding &&
      !element.hasDimensions[dimensionProperty] &&
      !hasTailwindPadding[side]
    ) {
      insufficientSides.push(side);
    }
  }

  /**
   * Log skipped sides for debugging
   */
  private logSkippedSides(element: ElementWithPadding, requiredPadding: number): void {
    // Log why we're skipping certain sides
    if (element.padding.top < requiredPadding && element.hasDimensions.height) {
      logger.debug(`Skipping top padding check for ${element.selector} - has fixed height`);
    }
    if (element.padding.bottom < requiredPadding && element.hasDimensions.height) {
      logger.debug(`Skipping bottom padding check for ${element.selector} - has fixed height`);
    }
    if (element.padding.left < requiredPadding && element.hasDimensions.width) {
      logger.debug(`Skipping left padding check for ${element.selector} - has fixed width`);
    }
    if (element.padding.right < requiredPadding && element.hasDimensions.width) {
      logger.debug(`Skipping right padding check for ${element.selector} - has fixed width`);
    }
  }

  /**
   * Create a padding issue
   */
  private createPaddingIssue(
    element: ElementWithPadding,
    insufficientSides: ("top" | "right" | "bottom" | "left")[]
  ): PaddingIssue {
    // Create element location with text content if available
    const location: ElementLocation = {
      selector: element.selector,
      x: element.bounds.x,
      y: element.bounds.y,
      width: element.bounds.width,
      height: element.bounds.height,
      ...(element.textContent ? { textContent: element.textContent } : {}),
    };

    // Determine severity
    const severity = determineSeverity(element, insufficientSides);

    // Create sides description
    const sidesText = insufficientSides.join(", ");

    // Create message with text content if available
    let message = `Element ${element.selector}`;
    if (element.textContent) {
      message += ` ("${element.textContent}")`;
    }
    message += ` has insufficient padding on ${sidesText}`;

    // Create an issue with only the properties defined in the PaddingIssue interface
    return {
      type: "padding",
      severity,
      message,
      elements: [location],
      sides: insufficientSides,
      computedPadding: element.padding,
    };
  }

  /**
   * Detect elements with insufficient padding
   */
  async detect(page: Page): Promise<Result<PaddingIssue[], PaddingError>> {
    logger.debug("Running padding detector");
    try {
      const elementsResult = await getElementsWithPadding(page);
      if (elementsResult.err) {
        logger.debug("Error getting elements with padding", elementsResult.val);
        return Err(elementsResult.val);
      }

      const elements = elementsResult.val;
      logger.debug(`Found ${elements.length} elements to check for padding issues`);
      logger.debug("Elements found:", elements);
      const issues: PaddingIssue[] = [];

      // Check each element for padding issues
      for (const element of elements) {
        logger.debug(`Checking element: ${element.selector}`, element);
        const issue = this.checkElementPadding(element);
        if (issue) {
          logger.debug(`Found padding issue for ${element.selector}`, issue);
          issues.push(issue);
        } else {
          logger.debug(`No padding issues for ${element.selector}`);
        }
      }

      return Ok(issues);
    } catch (error) {
      return Err({
        message: "Failed to detect padding issues",
        cause: error,
      });
    }
  }
}

export default new PaddingDetector();
