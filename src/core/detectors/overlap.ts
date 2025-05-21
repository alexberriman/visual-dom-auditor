import { type Page } from "playwright-core";
import { type Detector } from "../analyzer";
import { Ok, Err, type Result } from "../../types/ts-results";
import type { ElementLocation, OverlapIssue } from "../../types/issues";

type OverlapError = {
  message: string;
  cause?: unknown;
};

/**
 * Element with bounding box information
 */
interface ElementWithBounds {
  selector: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Calculate the overlap area between two bounding boxes
 */
const calculateOverlapArea = (
  a: ElementWithBounds,
  b: ElementWithBounds
): {
  width: number;
  height: number;
  area: number;
  percentage: number;
} | null => {
  const aRight = a.bounds.x + a.bounds.width;
  const aBottom = a.bounds.y + a.bounds.height;
  const bRight = b.bounds.x + b.bounds.width;
  const bBottom = b.bounds.y + b.bounds.height;

  // Check if the boxes overlap
  if (
    a.bounds.x >= bRight || // a is to the right of b
    aRight <= b.bounds.x || // a is to the left of b
    a.bounds.y >= bBottom || // a is below b
    aBottom <= b.bounds.y // a is above b
  ) {
    return null; // No overlap
  }

  // Calculate overlap dimensions
  const overlapWidth = Math.min(aRight, bRight) - Math.max(a.bounds.x, b.bounds.x);
  const overlapHeight = Math.min(aBottom, bBottom) - Math.max(a.bounds.y, b.bounds.y);
  const overlapArea = overlapWidth * overlapHeight;

  // Calculate smaller element area for percentage calculation
  const aArea = a.bounds.width * a.bounds.height;
  const bArea = b.bounds.width * b.bounds.height;
  const smallerArea = Math.min(aArea, bArea);

  // Calculate overlap percentage (of the smaller element)
  const percentage = smallerArea > 0 ? (overlapArea / smallerArea) * 100 : 0;

  return {
    width: overlapWidth,
    height: overlapHeight,
    area: overlapArea,
    percentage,
  };
};

/**
 * Determine severity based on overlap percentage
 */
const determineSeverity = (percentage: number): "critical" | "major" | "minor" => {
  if (percentage >= 50) {
    return "critical";
  } else if (percentage >= 25) {
    return "major";
  } else {
    return "minor";
  }
};

/**
 * Get information about visible elements on the page
 */
const getVisibleElements = async (
  page: Page
): Promise<Result<ElementWithBounds[], OverlapError>> => {
  try {
    // Get all visible elements with significant size
    // We exclude very small elements and those not visible
    const elements = await page.evaluate(() => {
      const MIN_ELEMENT_SIZE = 10; // Minimum size (width or height) to consider
      const SIGNIFICANT_ELEMENTS = [
        "div",
        "section",
        "article",
        "main",
        "aside",
        "header",
        "footer",
        "nav",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "table",
        "tr",
        "td",
        "th",
        "ul",
        "ol",
        "li",
        "img",
        "video",
        "audio",
        "form",
        "label",
        "span", // Include span as it's often used for important elements
      ].join(",");

      const boundedElements: ElementWithBounds[] = [];

      // Query significant elements
      const allElements = document.querySelectorAll(SIGNIFICANT_ELEMENTS);
      // Create array from NodeList for iteration
      const domElements = Array.prototype.slice.call(allElements);

      // Use numerical index for DOM element identification
      for (const [index, element] of domElements.entries()) {
        const rect = element.getBoundingClientRect();

        // Skip elements with zero size or very small elements
        if (
          rect.width < MIN_ELEMENT_SIZE ||
          rect.height < MIN_ELEMENT_SIZE ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return;
        }

        // Skip hidden elements or those with no visible content
        const styles = globalThis.getComputedStyle(element);
        if (
          styles.display === "none" ||
          styles.visibility === "hidden" ||
          styles.opacity === "0" ||
          (element.hasAttribute("aria-hidden") && element.getAttribute("aria-hidden") === "true")
        ) {
          return;
        }

        // Generate a unique selector for this element
        let selector = "";

        // Try to get id
        if (element.id) {
          selector = `#${element.id}`;
        } else {
          // Build path from element tag names
          selector = element.tagName.toLowerCase();

          // Add class names (up to 2)
          const classList = Array.prototype.slice.call(element.classList, 0, 2);
          if (classList.length > 0) {
            selector += `.${classList.join(".")}`;
          }

          // Add a data attribute to help identify it
          selector += `[data-vda-index="${index}"]`;
        }

        boundedElements.push({
          selector,
          bounds: {
            x: rect.left + globalThis.scrollX,
            y: rect.top + globalThis.scrollY,
            width: rect.width,
            height: rect.height,
          },
        });
      }

      return boundedElements as ElementWithBounds[];
    });

    return Ok(elements || []);
  } catch (error) {
    return Err({
      message: "Failed to get visible elements",
      cause: error,
    });
  }
};

/**
 * Detector for overlapping elements
 */
export class OverlapDetector implements Detector {
  // Configuration options
  private minOverlapPercentage: number;
  private ignoredSelectors: string[];

  constructor(options: { minOverlapPercentage?: number; ignoredSelectors?: string[] } = {}) {
    // Default threshold is 10% - below that is often intentional design
    this.minOverlapPercentage = options.minOverlapPercentage ?? 10;

    // Default ignored selectors (elements that commonly overlap by design)
    this.ignoredSelectors = options.ignoredSelectors ?? [
      "svg",
      ".icon",
      '[aria-hidden="true"]',
      "label",
      "option",
      "input + label",
      "select + label",
      // Commonly overlapping UI patterns
      ".tooltip",
      ".dropdown",
      ".menu",
      ".overlay",
      ".modal",
      ".badge",
      ".notification",
    ];
  }

  /**
   * Should this element be ignored in overlap detection
   */
  private shouldIgnoreElement(selector: string): boolean {
    return this.ignoredSelectors.some((ignored) => selector.includes(ignored));
  }

  /**
   * Detect overlapping elements on the page
   */
  async detect(page: Page): Promise<Result<OverlapIssue[], OverlapError>> {
    try {
      const elementsResult = await getVisibleElements(page);
      if (elementsResult.err) {
        return Err(elementsResult.val);
      }

      const elements = elementsResult.val;
      const issues: OverlapIssue[] = [];

      // Compare each element with every other element
      for (let i = 0; i < elements.length; i++) {
        const elementA = elements[i];

        // Skip ignored elements
        if (this.shouldIgnoreElement(elementA.selector)) {
          continue;
        }

        for (let j = i + 1; j < elements.length; j++) {
          const elementB = elements[j];

          // Skip ignored elements
          if (this.shouldIgnoreElement(elementB.selector)) {
            continue;
          }

          const overlap = calculateOverlapArea(elementA, elementB);

          // If there's significant overlap (above the threshold)
          if (overlap && overlap.percentage >= this.minOverlapPercentage) {
            const severity = determineSeverity(overlap.percentage);

            // Create element locations
            const locations: ElementLocation[] = [
              {
                selector: elementA.selector,
                x: elementA.bounds.x,
                y: elementA.bounds.y,
                width: elementA.bounds.width,
                height: elementA.bounds.height,
              },
              {
                selector: elementB.selector,
                x: elementB.bounds.x,
                y: elementB.bounds.y,
                width: elementB.bounds.width,
                height: elementB.bounds.height,
              },
            ];

            // Create an issue
            issues.push({
              type: "overlap",
              severity,
              message: `Elements ${elementA.selector} and ${elementB.selector} overlap by ${overlap.percentage.toFixed(1)}%`,
              elements: locations,
              overlapArea: {
                width: overlap.width,
                height: overlap.height,
                percentage: overlap.percentage,
              },
            });
          }
        }
      }

      return Ok(issues);
    } catch (error) {
      return Err({
        message: "Failed to detect overlapping elements",
        cause: error,
      });
    }
  }
}

export default new OverlapDetector();
