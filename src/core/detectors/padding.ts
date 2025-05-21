import { type Page } from "playwright-core";
import { type Detector } from "../analyzer";
import { Ok, Err, type Result } from "../../types/ts-results";
import type { ElementLocation, PaddingIssue } from "../../types/issues";

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
  "nav li",
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
 * Generate a selector for an element
 */
const generateSelector = (element: Element, index: number): string => {
  // Try to get id
  if (element.id) {
    return `#${element.id}`;
  }

  // Build path from element tag names
  let selector = element.tagName.toLowerCase();

  // Add class names (up to 2)
  const classList = Array.prototype.slice.call(element.classList, 0, 2);
  if (classList.length > 0) {
    selector += `.${classList.join(".")}`;
  }

  // Add a data attribute to help identify it
  return selector + `[data-vda-index="${index}"]`;
};

/**
 * Process text content, trimming and truncating if needed
 */
const processTextContent = (text: string): string => {
  const trimmed = text.trim();

  // Truncate to reasonable length (50 chars) if needed
  if (trimmed.length > 50) {
    return trimmed.substring(0, 47) + "...";
  }

  return trimmed;
};

/**
 * Get interactive elements with padding information
 */
const getElementsWithPadding = async (
  page: Page
): Promise<Result<ElementWithPadding[], PaddingError>> => {
  try {
    // Get all interactive elements that should have padding
    const elements = await page.evaluate(() => {
      const elementsWithPadding: ElementWithPadding[] = [];

      // Query the elements
      const allElements = document.querySelectorAll(INTERACTIVE_SELECTORS);

      // Create array from NodeList for iteration
      const domElements = Array.prototype.slice.call(allElements);

      // Process each element
      for (const [index, element] of domElements.entries()) {
        const rect = element.getBoundingClientRect();

        // Skip elements with zero size
        if (rect.width === 0 || rect.height === 0) {
          continue;
        }

        // Skip hidden elements
        const styles = globalThis.getComputedStyle(element);
        if (
          styles.display === "none" ||
          styles.visibility === "hidden" ||
          styles.opacity === "0" ||
          (element.hasAttribute("aria-hidden") && element.getAttribute("aria-hidden") === "true")
        ) {
          continue;
        }

        // Skip links with display:inline - they don't need padding
        if (element.tagName.toLowerCase() === "a" && styles.display === "inline") {
          continue;
        }

        // Generate a unique selector for this element
        const selector = generateSelector(element, index);

        // Get padding information
        const padding = {
          top: Number.parseInt(styles.paddingTop, 10),
          right: Number.parseInt(styles.paddingRight, 10),
          bottom: Number.parseInt(styles.paddingBottom, 10),
          left: Number.parseInt(styles.paddingLeft, 10),
        };

        // Process text content
        const textContent = processTextContent(element.textContent || "");

        elementsWithPadding.push({
          selector,
          tagName: element.tagName.toLowerCase(),
          textContent: textContent || undefined, // Only include if non-empty
          bounds: {
            x: rect.left + globalThis.scrollX,
            y: rect.top + globalThis.scrollY,
            width: rect.width,
            height: rect.height,
          },
          padding,
          display: styles.display,
        });
      }

      return elementsWithPadding;
    });

    return Ok(elements || []);
  } catch (error) {
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
    // Skip ignored elements
    if (this.shouldIgnoreElement(element.selector)) {
      return null;
    }

    // Skip links with display:inline as they don't need padding
    if (element.tagName === "a" && element.display === "inline") {
      return null;
    }

    // Determine the minimum padding required for this element
    const requiredPadding = this.hasStricterRequirements(element.selector)
      ? this.minimumPaddingPx * 1.5 // More padding for important elements
      : this.minimumPaddingPx;

    const insufficientSides: ("top" | "right" | "bottom" | "left")[] = [];

    // Check each side for insufficient padding
    if (element.padding.top < requiredPadding) insufficientSides.push("top");
    if (element.padding.right < requiredPadding) insufficientSides.push("right");
    if (element.padding.bottom < requiredPadding) insufficientSides.push("bottom");
    if (element.padding.left < requiredPadding) insufficientSides.push("left");

    // Only create issues if there are insufficient sides
    if (insufficientSides.length === 0) {
      return null;
    }

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

    // Create an issue
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
    try {
      const elementsResult = await getElementsWithPadding(page);
      if (elementsResult.err) {
        return Err(elementsResult.val);
      }

      const elements = elementsResult.val;
      const issues: PaddingIssue[] = [];

      // Check each element for padding issues
      for (const element of elements) {
        const issue = this.checkElementPadding(element);
        if (issue) {
          issues.push(issue);
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
