import { type Page } from "playwright-core";
import { type Detector } from "../analyzer";
import { Result, Ok, Err } from "ts-results";
import type { ElementLocation, LayoutIssue } from "../../types/issues";

type FlexGridError = {
  message: string;
  cause?: unknown;
};

/**
 * Element with flex/grid layout information
 */
interface LayoutElement {
  selector: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  layoutType: "flex" | "grid";
  style: {
    display: string;
    direction?: string;
    flexDirection?: string;
    flexWrap?: string;
    alignItems?: string;
    justifyContent?: string;
    gap?: string;
    rowGap?: string;
    columnGap?: string;
    gridTemplateColumns?: string;
    gridTemplateRows?: string;
    gridAutoFlow?: string;
    overflow?: string;
    minWidth?: string;
    maxWidth?: string;
    minHeight?: string;
    maxHeight?: string;
  };
  children: {
    selector: string;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    style: {
      flexGrow?: string;
      flexShrink?: string;
      flexBasis?: string;
      alignSelf?: string;
      justifySelf?: string;
      overflow?: string;
      minWidth?: string;
      maxWidth?: string;
      minHeight?: string;
      maxHeight?: string;
      gridColumn?: string;
      gridRow?: string;
    };
  }[];
}

// Check if element is hidden
function isHidden(element: Element, styles: CSSStyleDeclaration) {
  return (
    styles.display === "none" ||
    styles.visibility === "hidden" ||
    styles.opacity === "0" ||
    (element.hasAttribute("aria-hidden") && element.getAttribute("aria-hidden") === "true")
  );
}

// Generate a selector for an element
function generateSelector(element: Element) {
  if (element.id) {
    return `#${element.id}`;
  }

  const tagName = element.tagName.toLowerCase();
  const classList = Array.prototype.slice.call(element.classList, 0, 2);

  if (classList.length > 0) {
    return `${tagName}.${classList.join(".")}`;
  }

  return tagName;
}

// Create bounds object from rect
function createBounds(rect: DOMRect) {
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

// Create style object for a child element
function createChildStyle(styles: CSSStyleDeclaration, layoutType: "flex" | "grid") {
  return {
    flexGrow: layoutType === "flex" ? styles.flexGrow : undefined,
    flexShrink: layoutType === "flex" ? styles.flexShrink : undefined,
    flexBasis: layoutType === "flex" ? styles.flexBasis : undefined,
    alignSelf: styles.alignSelf,
    justifySelf: styles.justifySelf,
    overflow: styles.overflow,
    minWidth: styles.minWidth,
    maxWidth: styles.maxWidth,
    minHeight: styles.minHeight,
    maxHeight: styles.maxHeight,
    gridColumn: layoutType === "grid" ? styles.gridColumn : undefined,
    gridRow: layoutType === "grid" ? styles.gridRow : undefined,
  };
}

// Create style object for a container element
function createContainerStyle(styles: CSSStyleDeclaration, layoutType: "flex" | "grid") {
  return {
    display: styles.display,
    direction: styles.direction,
    flexDirection: layoutType === "flex" ? styles.flexDirection : undefined,
    flexWrap: layoutType === "flex" ? styles.flexWrap : undefined,
    alignItems: styles.alignItems,
    justifyContent: styles.justifyContent,
    gap: styles.gap,
    rowGap: styles.rowGap,
    columnGap: styles.columnGap,
    gridTemplateColumns: layoutType === "grid" ? styles.gridTemplateColumns : undefined,
    gridTemplateRows: layoutType === "grid" ? styles.gridTemplateRows : undefined,
    gridAutoFlow: layoutType === "grid" ? styles.gridAutoFlow : undefined,
    overflow: styles.overflow,
    minWidth: styles.minWidth,
    maxWidth: styles.maxWidth,
    minHeight: styles.minHeight,
    maxHeight: styles.maxHeight,
  };
}

/**
 * Get information about flex and grid layout elements on the page
 */
const getLayoutElements = async (page: Page): Promise<Result<LayoutElement[], FlexGridError>> => {
  try {
    // Get all flex and grid containers with their styles and children
    const layoutElements = await page.evaluate(() => {
      const MIN_ELEMENT_SIZE = 10; // Minimum size (width or height) to consider
      const elements: LayoutElement[] = [];

      // Query all flex and grid containers
      const flexContainers = document.querySelectorAll(
        '[style*="display: flex"], [style*="display:flex"], [class*="flex"]'
      );
      const gridContainers = document.querySelectorAll(
        '[style*="display: grid"], [style*="display:grid"], [class*="grid"]'
      );

      // Check if element should be skipped based on size
      function isTooSmall(rect: DOMRect) {
        return (
          rect.width < MIN_ELEMENT_SIZE ||
          rect.height < MIN_ELEMENT_SIZE ||
          rect.width === 0 ||
          rect.height === 0
        );
      }

      // Process a child element
      function processChild(child: Element, layoutType: "flex" | "grid") {
        const childRect = child.getBoundingClientRect();

        // Skip hidden or zero-sized children
        if (isTooSmall(childRect)) {
          return null;
        }

        const childSelector = generateSelector(child);
        const childStyles = globalThis.getComputedStyle(child);

        return {
          selector: childSelector,
          bounds: createBounds(childRect),
          style: createChildStyle(childStyles, layoutType),
        };
      }

      // Process children of a container
      function processChildren(element: Element, layoutType: "flex" | "grid") {
        const children = [];

        // Convert HTMLCollection to array before iterating
        const childrenArray = Array.prototype.slice.call(element.children);

        for (const child of childrenArray) {
          const childData = processChild(child, layoutType);
          if (childData) {
            children.push(childData);
          }
        }

        return children;
      }

      // Process a container element
      function processContainer(element: Element, layoutType: "flex" | "grid") {
        const rect = element.getBoundingClientRect();

        // Skip very small elements
        if (isTooSmall(rect)) {
          return;
        }

        const styles = globalThis.getComputedStyle(element);

        // Skip hidden elements
        if (isHidden(element, styles)) {
          return;
        }

        // Generate a selector
        const selector = generateSelector(element);

        // Process children
        const children = processChildren(element, layoutType);

        // Only create and include containers with children
        if (children.length > 0) {
          // Create the layout element
          const layoutElement = {
            selector,
            bounds: createBounds(rect),
            layoutType,
            style: createContainerStyle(styles, layoutType),
            children,
          };

          elements.push(layoutElement);
        }
      }

      // Process all containers
      // Convert NodeListOf to arrays before iterating
      const flexArray = Array.prototype.slice.call(flexContainers);
      const gridArray = Array.prototype.slice.call(gridContainers);

      for (const container of flexArray) {
        processContainer(container, "flex");
      }
      for (const container of gridArray) {
        processContainer(container, "grid");
      }

      return elements;
    });

    return Ok(layoutElements || []);
  } catch (error) {
    return Err({
      message: "Failed to get flex/grid layout elements",
      cause: error,
    });
  }
};

/**
 * Determine severity based on issue type and context
 */
const determineSeverity = (problems: string[]): "critical" | "major" | "minor" => {
  if (problems.some((p) => p.includes("overflow") || p.includes("squished"))) {
    return "major";
  } else if (problems.some((p) => p.includes("incorrect gap") || p.includes("misaligned"))) {
    return "major";
  } else {
    return "minor";
  }
};

/**
 * Detector for broken flex/grid layouts
 */
export class FlexGridLayoutDetector implements Detector {
  // Configuration options
  private minChildWidth: number;
  private minGap: number;
  private ignoredSelectors: string[];

  constructor(
    options: { minChildWidth?: number; minGap?: number; ignoredSelectors?: string[] } = {}
  ) {
    // Default minimum child width is 10px (below this is likely a design choice)
    this.minChildWidth = options.minChildWidth ?? 10;

    // Default minimum gap is 4px
    this.minGap = options.minGap ?? 4;

    // Default ignored selectors
    this.ignoredSelectors = options.ignoredSelectors ?? [
      ".icon",
      ".badge",
      ".tooltip",
      ".avatar",
      "svg",
      "img",
    ];
  }

  /**
   * Should this element be ignored in layout detection
   */
  private shouldIgnoreElement(selector: string): boolean {
    return this.ignoredSelectors.some((ignored) => selector.includes(ignored));
  }

  /**
   * Check for flex layout issues
   */
  private checkFlexLayoutIssues(container: LayoutElement): string[] {
    const problems: string[] = [];

    // Check for flex direction issues
    if (!container.style.flexDirection) {
      problems.push("missing flexDirection property");
    }

    // Check for wrap issues on containers with multiple children
    if (container.children.length > 3 && container.style.flexWrap === "nowrap") {
      const containerIsRow = container.style.flexDirection?.includes("row");
      const totalChildrenSize = container.children.reduce((total, child) => {
        return total + (containerIsRow ? child.bounds.width : child.bounds.height);
      }, 0);

      const containerSize = containerIsRow ? container.bounds.width : container.bounds.height;

      if (totalChildrenSize > containerSize * 1.1) {
        // Allow 10% tolerance
        problems.push("children overflow container without flex-wrap");
      }
    }

    // Check for squeezed items (flexGrow: 0, flexShrink: 1)
    const hasSqueezeItems = container.children.some((child) => {
      const flexShrink = Number(child.style.flexShrink) || 1; // Default is 1
      const flexGrow = Number(child.style.flexGrow) || 0; // Default is 0

      // Child is squishable but not growable
      return (
        flexShrink > 0 &&
        flexGrow === 0 &&
        (child.bounds.width < this.minChildWidth || child.bounds.height < this.minChildWidth)
      );
    });

    if (hasSqueezeItems) {
      problems.push("some children are excessively squeezed (consider using min-width/min-height)");
    }

    // Check for missing gap
    if (!container.style.gap && !container.style.rowGap && !container.style.columnGap) {
      // Check if children are touching with no margin
      const touchingChildren = container.children.some((child, i) => {
        if (i === 0) return false;

        const prevChild = container.children[i - 1];
        const isRow = container.style.flexDirection?.includes("row");

        if (isRow) {
          const gap = child.bounds.x - (prevChild.bounds.x + prevChild.bounds.width);
          return gap < this.minGap;
        } else {
          const gap = child.bounds.y - (prevChild.bounds.y + prevChild.bounds.height);
          return gap < this.minGap;
        }
      });

      if (touchingChildren) {
        problems.push("children have insufficient spacing (consider using gap property)");
      }
    }

    return problems;
  }

  /**
   * Calculate coefficient of variation (standard deviation / mean)
   */
  private calculateCV(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 0;

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean;
  }

  /**
   * Check for grid layout issues
   */
  private checkGridLayoutIssues(container: LayoutElement): string[] {
    const problems: string[] = [];

    // Check for missing grid template
    if (!container.style.gridTemplateColumns && !container.style.gridTemplateRows) {
      problems.push("missing grid template definitions");
    }

    // Check for uneven grid items (width or height varies significantly)
    const childWidths = container.children.map((child) => child.bounds.width);
    const childHeights = container.children.map((child) => child.bounds.height);

    const widthCV = this.calculateCV(childWidths);
    const heightCV = this.calculateCV(childHeights);

    // If CV > 0.3 (30% variation), it suggests uneven sizing
    if ((widthCV > 0.3 || heightCV > 0.3) && container.children.length > 2) {
      problems.push("grid items have inconsistent sizing");
    }

    // Check for children overflowing their grid cells
    const containerOverflow = container.style.overflow || "";
    const overflowingChildren = container.children.some((child) => {
      return (
        child.bounds.width > container.bounds.width || child.bounds.height > container.bounds.height
      );
    });

    if (overflowingChildren && containerOverflow === "hidden") {
      problems.push("children overflow their grid container with overflow:hidden");
    }

    // Check for missing gap between grid items
    if (!container.style.gap && !container.style.rowGap && !container.style.columnGap) {
      problems.push("grid layout missing gap property");
    }

    return problems;
  }

  /**
   * Detect flex/grid layout issues on the page
   */
  async detect(page: Page): Promise<Result<LayoutIssue[], FlexGridError>> {
    try {
      const elementsResult = await getLayoutElements(page);
      if (elementsResult.err) {
        return Err(elementsResult.val);
      }

      const elements = elementsResult.val;
      const issues: LayoutIssue[] = [];

      // Check each flex and grid container for issues
      for (const container of elements) {
        // Skip ignored containers
        if (this.shouldIgnoreElement(container.selector)) {
          continue;
        }

        // Skip containers with no children
        if (container.children.length === 0) {
          continue;
        }

        // Check for issues based on layout type
        const problems =
          container.layoutType === "flex"
            ? this.checkFlexLayoutIssues(container)
            : this.checkGridLayoutIssues(container);

        // If problems were found, create an issue
        if (problems.length > 0) {
          const severity = determineSeverity(problems);

          // Create element locations
          const locations: ElementLocation[] = [
            // Parent container
            {
              selector: container.selector,
              x: container.bounds.x,
              y: container.bounds.y,
              width: container.bounds.width,
              height: container.bounds.height,
            },
            // Include affected children (up to 3)
            ...container.children.slice(0, 3).map((child) => ({
              selector: child.selector,
              x: child.bounds.x,
              y: child.bounds.y,
              width: child.bounds.width,
              height: child.bounds.height,
            })),
          ];

          // Create an issue
          issues.push({
            type: "layout",
            severity,
            message: `${container.layoutType} layout issues in ${container.selector}: ${problems.join("; ")}`,
            elements: locations,
            layoutType: container.layoutType,
            problems,
          });
        }
      }

      return Ok(issues);
    } catch (error) {
      return Err({
        message: "Failed to detect flex/grid layout issues",
        cause: error,
      });
    }
  }
}

export default new FlexGridLayoutDetector();
