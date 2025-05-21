import { type Page } from "playwright-core";
import { type Detector } from "../analyzer";
import { Ok, Err, type Result } from "../../types/ts-results";
import type { ElementLocation, ContainerOverflowIssue } from "../../types/issues";

type ContainerOverflowError = {
  message: string;
  cause?: unknown;
};

/**
 * Parent-child relationship with bounding information
 */
interface ContainerChildPair {
  parent: {
    selector: string;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  child: {
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
 * Calculate overflow amounts for a child element relative to its parent container
 */
const calculateOverflow = (
  parent: ContainerChildPair["parent"],
  child: ContainerChildPair["child"]
): {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
} | null => {
  const parentRight = parent.bounds.x + parent.bounds.width;
  const parentBottom = parent.bounds.y + parent.bounds.height;
  const childRight = child.bounds.x + child.bounds.width;
  const childBottom = child.bounds.y + child.bounds.height;

  // Check if there's any overflow
  const topOverflow =
    parent.bounds.y > child.bounds.y ? parent.bounds.y - child.bounds.y : undefined;
  const rightOverflow = childRight > parentRight ? childRight - parentRight : undefined;
  const bottomOverflow = childBottom > parentBottom ? childBottom - parentBottom : undefined;
  const leftOverflow =
    parent.bounds.x > child.bounds.x ? parent.bounds.x - child.bounds.x : undefined;

  // If no overflow, return null
  if (!topOverflow && !rightOverflow && !bottomOverflow && !leftOverflow) {
    return null;
  }

  return {
    top: topOverflow,
    right: rightOverflow,
    bottom: bottomOverflow,
    left: leftOverflow,
  };
};

/**
 * Determine severity based on overflow amount relative to container size
 */
const determineSeverity = (
  overflow: ReturnType<typeof calculateOverflow>,
  containerWidth: number,
  containerHeight: number
): "critical" | "major" | "minor" => {
  if (!overflow) return "minor";

  // Calculate the max overflow percentage relative to container dimension
  const horizontalPercentage = Math.max(
    overflow.left ? (overflow.left / containerWidth) * 100 : 0,
    overflow.right ? (overflow.right / containerWidth) * 100 : 0
  );

  const verticalPercentage = Math.max(
    overflow.top ? (overflow.top / containerHeight) * 100 : 0,
    overflow.bottom ? (overflow.bottom / containerHeight) * 100 : 0
  );

  const maxPercentage = Math.max(horizontalPercentage, verticalPercentage);

  if (maxPercentage >= 30) {
    return "critical";
  } else if (maxPercentage >= 15) {
    return "major";
  } else {
    return "minor";
  }
};

/**
 * Function to process DOM elements and detect potential container-child pairs
 */
const processDOM = `
function getElementSelector(element, indexMap, indexCounter) {
  // Use ID if available
  if (element.id) {
    return { selector: "#" + element.id, index: indexCounter };
  }
  
  // Create a proper selector
  let selector = element.tagName.toLowerCase();
  
  // Add classes (max 2)
  if (element.classList.length > 0) {
    const classes = [];
    for (let i = 0; i < Math.min(element.classList.length, 2); i++) {
      classes.push(element.classList[i]);
    }
    if (classes.length > 0) {
      selector += "." + classes.join(".");
    }
  }
  
  // Add index attribute
  if (!indexMap.has(element)) {
    indexMap.set(element, indexCounter++);
  }
  const index = indexMap.get(element);
  selector += "[data-vda-index='" + index + "']";
  
  return { selector, index: indexCounter };
}

function isElementVisible(element) {
  const MIN_SIZE = 20;
  const rect = element.getBoundingClientRect();
  
  // Check size
  if (rect.width < MIN_SIZE || rect.height < MIN_SIZE || 
      rect.width === 0 || rect.height === 0) {
    return false;
  }
  
  // Check visibility
  const style = window.getComputedStyle(element);
  return !(style.display === "none" || 
           style.visibility === "hidden" || 
           style.opacity === "0" || 
           parseFloat(style.opacity) === 0);
}

function shouldProcessContainer(element) {
  if (!isElementVisible(element)) {
    return false;
  }
  
  // Check overflow settings
  const style = window.getComputedStyle(element);
  const overflow = style.overflow;
  const overflowX = style.overflowX;
  const overflowY = style.overflowY;
  
  // Skip containers where overflow is expected
  return !(overflow === "scroll" || overflow === "auto" ||
           overflowX === "scroll" || overflowX === "auto" ||
           overflowY === "scroll" || overflowY === "auto");
}

const containerSelectors = [
  "div", "section", "article", "main", "aside", "header", 
  "footer", "nav", "form", "ul", "ol", "table", "tr", "td", "th"
].join(",");

const pairs = [];
const indexMap = new Map();
let indexCounter = 0;

// Query all potential containers
const containers = document.querySelectorAll(containerSelectors);

// Process each container
for (let i = 0; i < containers.length; i++) {
  const container = containers[i];
  
  if (!shouldProcessContainer(container)) {
    continue;
  }
  
  const containerRect = container.getBoundingClientRect();
  const { selector: containerSelector, index: newIndex } = 
    getElementSelector(container, indexMap, indexCounter);
  
  indexCounter = newIndex;
  
  // Process children
  const children = container.children;
  for (let j = 0; j < children.length; j++) {
    const child = children[j];
    
    if (!isElementVisible(child)) {
      continue;
    }
    
    const childRect = child.getBoundingClientRect();
    const { selector: childSelector, index: finalIndex } = 
      getElementSelector(child, indexMap, indexCounter);
    
    indexCounter = finalIndex;
    
    // Add to results
    pairs.push({
      parent: {
        selector: containerSelector,
        bounds: {
          x: containerRect.left + window.scrollX,
          y: containerRect.top + window.scrollY,
          width: containerRect.width,
          height: containerRect.height
        }
      },
      child: {
        selector: childSelector,
        bounds: {
          x: childRect.left + window.scrollX,
          y: childRect.top + window.scrollY,
          width: childRect.width,
          height: childRect.height
        }
      }
    });
  }
}

return pairs;
`;

/**
 * Get container-child pairs to analyze for overflow
 */
const getContainerChildPairs = async (
  page: Page
): Promise<Result<ContainerChildPair[], ContainerOverflowError>> => {
  try {
    const pairs = (await page.evaluate(processDOM)) as ContainerChildPair[];
    return Ok(pairs);
  } catch (error) {
    return Err({
      message: "Failed to get container-child pairs",
      cause: error,
    });
  }
};

/**
 * Detector for container overflow issues
 */
export class ContainerOverflowDetector implements Detector {
  // Configuration options
  private minOverflowPx: number;
  private ignoredSelectors: string[];

  constructor(options: { minOverflowPx?: number; ignoredSelectors?: string[] } = {}) {
    // Default minimum overflow threshold in pixels
    this.minOverflowPx = options.minOverflowPx ?? 5;

    // Default ignored selectors (elements where overflow is often intentional)
    this.ignoredSelectors = options.ignoredSelectors ?? [
      ".dropdown",
      ".tooltip",
      ".popup",
      ".modal",
      "[role='dialog']",
      "[role='tooltip']",
      "[role='menu']",
      ".menu",
      ".overflow",
      // Common components that might have intentional overflow
      "code",
      "pre",
    ];
  }

  /**
   * Should this element be ignored in overflow detection
   */
  private shouldIgnoreElement(selector: string): boolean {
    return this.ignoredSelectors.some((ignored) => selector.includes(ignored));
  }

  /**
   * Detect elements that overflow their containers
   */
  async detect(page: Page): Promise<Result<ContainerOverflowIssue[], ContainerOverflowError>> {
    try {
      const pairsResult = await getContainerChildPairs(page);
      if (pairsResult.err) {
        return Err(pairsResult.val);
      }

      const pairs = pairsResult.val;
      const issues: ContainerOverflowIssue[] = [];

      // Check each container-child pair for overflow
      for (const { parent, child } of pairs) {
        // Skip if either element should be ignored
        if (this.shouldIgnoreElement(parent.selector) || this.shouldIgnoreElement(child.selector)) {
          continue;
        }

        // Calculate overflow
        const overflow = calculateOverflow(parent, child);

        // Skip if no overflow or if overflow is below threshold
        if (!overflow) {
          continue;
        }

        // Check if any overflow exceeds the minimum threshold
        const hasSignificantOverflow = Object.values(overflow).some(
          (value) => value !== null && value !== undefined && value >= this.minOverflowPx
        );

        if (!hasSignificantOverflow) {
          continue;
        }

        const severity = determineSeverity(overflow, parent.bounds.width, parent.bounds.height);

        // Create element locations
        const locations: ElementLocation[] = [
          {
            selector: parent.selector,
            x: parent.bounds.x,
            y: parent.bounds.y,
            width: parent.bounds.width,
            height: parent.bounds.height,
          },
          {
            selector: child.selector,
            x: child.bounds.x,
            y: child.bounds.y,
            width: child.bounds.width,
            height: child.bounds.height,
          },
        ];

        // Create an issue
        issues.push({
          type: "container-overflow",
          severity,
          message: `Element ${child.selector} overflows its container ${parent.selector}`,
          elements: locations,
          overflowAmount: overflow,
        });
      }

      return Ok(issues);
    } catch (error) {
      return Err({
        message: "Failed to detect container overflow issues",
        cause: error,
      });
    }
  }
}

export default new ContainerOverflowDetector();
