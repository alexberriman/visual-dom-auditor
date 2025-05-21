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
  textContent?: string; // Add text content for text elements
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
// Helper function to filter DOM elements
const filterDomElements = (elements: Element[], minSize: number): Element[] => {
  return elements.filter(element => {
    const rect = element.getBoundingClientRect();
    
    // Skip elements with zero size or very small elements
    if (rect.width < minSize || rect.height < minSize || rect.width === 0 || rect.height === 0) {
      return false;
    }
    
    // Skip hidden elements
    const styles = globalThis.getComputedStyle(element);
    if (
      styles.display === "none" ||
      styles.visibility === "hidden" ||
      styles.opacity === "0" ||
      parseFloat(styles.opacity) === 0 ||
      (element.hasAttribute("aria-hidden") && element.getAttribute("aria-hidden") === "true")
    ) {
      return false;
    }
    
    // Skip absolutely positioned elements in a relative container, EXCEPT for navigation/header elements
    const isNavOrHeaderElement = element.tagName.toLowerCase() === 'nav' || 
                                 element.tagName.toLowerCase() === 'header' ||
                                 (element.className && (
                                   element.className.includes('nav') || 
                                   element.className.includes('menu') || 
                                   element.className.includes('logo') || 
                                   element.className.includes('brand')
                                 ));
                                 
    // Never filter navigation/header elements based on positioning
    if (!isNavOrHeaderElement && 
        styles.position === "absolute" && 
        (element.parentElement && globalThis.getComputedStyle(element.parentElement).position === "relative")) {
      return false;
    }
    
    // Skip if z-index suggests intentional layering, BUT not for navigation elements
    const isNavOrHeader = element.tagName.toLowerCase() === 'nav' || 
                          element.tagName.toLowerCase() === 'header' ||
                          (element.className && (
                            element.className.includes('nav') || 
                            element.className.includes('menu') || 
                            element.className.includes('logo') || 
                            element.className.includes('brand')
                          ));
    
    // Never filter navigation elements based on z-index
    if (!isNavOrHeader && styles.zIndex && parseInt(styles.zIndex, 10) > 1) {
      return false;
    }
    
    return true;
  });
};

// Helper function to create element selectors
const createElementSelector = (element: Element, index: number): string => {
  if (element.id) {
    return `#${element.id}`;
  }
  
  let selector = element.tagName.toLowerCase();
  
  // Add classes if no ID
  const classList = Array.from(element.classList).slice(0, 2);
  if (classList.length > 0) {
    selector += `.${classList.join(".")}`;
  }
  
  return selector + `[data-vda-index="${index}"]`;
};

// Helper function to extract element text content
const extractTextContent = (element: Element): string | undefined => {
  const isTextElement = /^(h[1-6]|p|span|a|button|label|li)$/i.test(element.tagName);
  if (!isTextElement) {
    return undefined;
  }
  
  const rawText = element.textContent || "";
  const trimmedText = rawText.trim();
  
  // Only include text if it's not empty
  if (!trimmedText || trimmedText.length === 0) {
    return undefined;
  }
  
  // Truncate long text
  return trimmedText.length > 50 
    ? trimmedText.substring(0, 47) + "..."
    : trimmedText;
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
      
      // Focus mainly on presentational and interactive elements that should not overlap
      // Exclude most structural/container elements that naturally overlap (div, section, etc.)
      const PRESENTATIONAL_ELEMENTS = [
        // Interactive elements
        "button", "a", "input:not([type=hidden])", "select", "textarea",
        "[role=button]", "[role=link]", "[role=menuitem]",
        
        // Content elements
        "img", "video", "canvas", "svg", 
        
        // Text content that shouldn't overlap other text
        "h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "span",
        
        // UI components that should be distinct
        ".card", ".btn", ".button", ".nav-item", ".menu-item", ".badge:not(.notification)",
        
        // Navigation and header components - CRITICAL to detect
        "nav", ".navigation", ".navbar", ".nav", ".menu", "header", 
        "header > *", // Children of header
        ".logo", ".brand", // Brand elements
        "[class*='logo']", "[class*='brand']", // Elements with logo or brand in class names
        
        // Other container elements
        "footer > *",  // Children of footer, not the footer itself
      ].join(",");

      // Get all elements and filter them
      const allElements = document.querySelectorAll(PRESENTATIONAL_ELEMENTS);
      const domElements = Array.from(allElements);
      const filteredElements = filterDomElements(domElements, MIN_ELEMENT_SIZE);
      
      // Convert to bounded elements
      return filteredElements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const styles = globalThis.getComputedStyle(element);
        const isFixed = styles.position === "fixed";
        const selector = createElementSelector(element, index);
        const textContent = extractTextContent(element);
        
        return {
          selector,
          ...(textContent ? { textContent } : {}),
          bounds: {
            x: rect.left + (isFixed ? 0 : globalThis.scrollX),
            y: rect.top + (isFixed ? 0 : globalThis.scrollY),
            width: rect.width,
            height: rect.height,
          },
        };
      });
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
  private ignoreParentChildOverlaps: boolean;
  private specialHeaderDetection: boolean; // New option to force header detection

  constructor(options: { 
    minOverlapPercentage?: number; 
    ignoredSelectors?: string[];
    ignoreParentChildOverlaps?: boolean;
    specialHeaderDetection?: boolean;
  } = {}) {
    // Default threshold is 5% - lower than before to catch more overlaps
    this.minOverlapPercentage = options.minOverlapPercentage ?? 5;

    // By default, ignore parent-child overlaps (these are expected),
    // but we still want to detect navigation overlaps
    this.ignoreParentChildOverlaps = options.ignoreParentChildOverlaps ?? true;
    
    // Turn on special header detection by default
    this.specialHeaderDetection = options.specialHeaderDetection ?? true;

    // Default ignored selectors (elements that commonly overlap by design)
    this.ignoredSelectors = options.ignoredSelectors ?? [
      // Accessibility and form elements
      '[aria-hidden="true"]',
      "label",
      "option",
      "input + label",
      "select + label",
      
      // Commonly overlapping UI patterns
      ".tooltip",
      ".popover",
      ".dropdown-menu", 
      ".menu-items",
      ".overlay",
      ".modal",
      ".dialog",
      ".notification",
      ".toast",
      
      // Icons and decorative elements
      "svg:not(.logo)",
      ".icon:not(.logo, .brand)",
      ".fa", // Font Awesome
      ".material-icons",
      
      // Badge and indicators that often overlay
      ".badge",
      ".indicator",
      ".counter",
      ".dot",
      
      // Common container relationships that are expected to overlap
      "#root",
      "body > div",
      "div.min-h-screen",
      "div.container",
      "main", 
      "section",
      "article",
      
      // Images and media that might have intentional overlays
      ".image-overlay",
      ".media-overlay",
      ".thumbnail-overlay",
      
      // Common dynamic pattern elements
      ".carousel",
      ".slider",
      ".tabs",
      ".accordion"
    ];
  }

  /**
   * Check if an element should be ignored in overlap detection
   */
  private shouldIgnoreElement(selector: string): boolean {
    return this.ignoredSelectors.some((ignored) => {
      // Handle class selectors
      if (ignored.startsWith(".")) {
        const className = ignored.substring(1);
        const classRegex = new RegExp(`\\.${className}($|[\\s\\.])`, "i");
        return classRegex.test(selector);
      }
      
      // Handle ID selectors
      if (ignored.startsWith("#")) {
        return selector === ignored;
      }
      
      // Handle attribute selectors
      if (ignored.includes("[") && ignored.includes("]")) {
        return selector.includes(ignored);
      }
      
      // Handle element selectors
      if (!ignored.includes(".") && !ignored.includes("#") && !ignored.includes("[")) {
        return selector === ignored || selector.startsWith(`${ignored}.`) || 
               selector.startsWith(`${ignored}[`);
      }
      
      // Default case
      return selector.includes(ignored);
    });
  }

  /**
   * Checks if a selector appears to be a container element 
   * (but allows header and navigation to be detected)
   */
  private isContainerElement(selector: string): boolean {
    // Only filter out generic divs and sections, not header/nav elements
    const isNonSpecificContainer = (
      (selector.startsWith("div") || selector.startsWith("section")) &&
      !selector.includes("header") && 
      !selector.includes("nav") && 
      !selector.includes("navigation") && 
      !selector.includes("navbar") &&
      !selector.includes("menu")
    );
    
    // Ignore non-specific divs and sections, but NOT UI-specific containers
    return isNonSpecificContainer;
  }
  
  /**
   * Checks if elements appear to be a parent-child relationship with intended overlaps
   * but not overlaps in the navigation
   */
  private isParentChildOverlap(elementA: ElementWithBounds, elementB: ElementWithBounds): boolean {
    // Image inside a link or button - common pattern, not a real issue
    const imageInLink = (
      (elementA.selector.startsWith('a') && elementB.selector.startsWith('img')) ||
      (elementA.selector.startsWith('img') && elementB.selector.startsWith('a')) ||
      (elementA.selector.startsWith('button') && elementB.selector.startsWith('img')) ||
      (elementA.selector.startsWith('img') && elementB.selector.startsWith('button'))
    );
    
    // Text inside a button or link, BUT keep header/nav text overlaps
    const isHeaderNavElement = (selector: string): boolean => {
      return selector.includes('header') || 
             selector.includes('nav') || 
             selector.includes('navigation') ||
             selector.includes('navbar');
    };
    
    // If either is a header/nav element, DON'T filter it out
    if (isHeaderNavElement(elementA.selector) || isHeaderNavElement(elementB.selector)) {
      return false;
    }
    
    // Text inside a button or link - common pattern, not a real issue
    const textInInteractive = (
      (elementA.selector.startsWith('button') && 
       (elementB.selector.startsWith('h') || elementB.selector.startsWith('p') || elementB.selector.startsWith('span'))) ||
      (elementB.selector.startsWith('button') && 
       (elementA.selector.startsWith('h') || elementA.selector.startsWith('p') || elementA.selector.startsWith('span'))) ||
      (elementA.selector.startsWith('a') && 
       (elementB.selector.startsWith('h') || elementB.selector.startsWith('p') || elementB.selector.startsWith('span'))) ||
      (elementB.selector.startsWith('a') && 
       (elementA.selector.startsWith('h') || elementA.selector.startsWith('p') || elementA.selector.startsWith('span')))
    );
    
    return imageInLink || textInInteractive;
  }
  
  /**
   * Checks if elements are likely part of normal page flow with expected overlaps
   */
  private isNormalFlowOverlap(
    elementA: ElementWithBounds, 
    elementB: ElementWithBounds,
    overlap: {width: number; height: number; area: number; percentage: number;}
  ): boolean {
    // Never filter out header or nav elements
    if (elementA.selector.includes('header') || elementA.selector.includes('nav') ||
        elementB.selector.includes('header') || elementB.selector.includes('nav')) {
      return false;
    }
    
    // Check for elements that are likely to be stacked vertically by design
    const isStackedTextContent = (
      (elementA.selector.startsWith('p') || elementA.selector.startsWith('h')) &&
      (elementB.selector.startsWith('p') || elementB.selector.startsWith('h')) &&
      // Near-identical width suggests they're in the same column
      Math.abs(elementA.bounds.width - elementB.bounds.width) < 10 &&
      // Vertical overlap with minimal horizontal offset
      Math.abs(elementA.bounds.x - elementB.bounds.x) < 5
    );
    
    // Items with similar dimensions and high vertical alignment in a menu/list,
    // but never filter out actual navigation menu items
    const potentialMenuItems = (
      elementA.selector.includes('item') && elementB.selector.includes('item') &&
      !elementA.selector.includes('nav-item') && !elementB.selector.includes('nav-item') &&
      Math.abs(elementA.bounds.height - elementB.bounds.height) < 5 &&
      Math.abs(elementA.bounds.width - elementB.bounds.width) < 50
    );
    
    // Grid or list items that appear to overlap but are likely just adjacent
    const adjacentItems = (
      (elementA.bounds.y + elementA.bounds.height === elementB.bounds.y ||
       elementA.bounds.x + elementA.bounds.width === elementB.bounds.x) &&
      overlap.percentage < 15 // Small overlap percentage
    );
    
    // Skip very small overlaps for non-interactive elements,
    // but keep overlaps between interactive elements regardless of size
    const hasInteractiveElement = 
      elementA.selector.includes('button') || elementA.selector.includes('a') ||
      elementB.selector.includes('button') || elementB.selector.includes('a');
    
    const tinyOverlap = !hasInteractiveElement && overlap.area < 50;
    
    return isStackedTextContent || potentialMenuItems || adjacentItems || tinyOverlap;
  }
  
  /**
   * Filter out overlaps that are likely to be false positives
   * We've revised this to ensure navigation and header overlaps are detected
   */
  private isLikelyFalsePositive(
    elementA: ElementWithBounds, 
    elementB: ElementWithBounds, 
    overlap: {width: number; height: number; area: number; percentage: number;}
  ): boolean {
    // Never filter out header/navbar elements
    const isHeaderOrNav = (selector: string): boolean => {
      return selector.includes('header') || 
             selector.includes('nav') || 
             selector.includes('navigation') ||
             selector.includes('navbar');
    };
    
    // If either element is a nav element, we always want to see overlaps - never filter
    if (isHeaderOrNav(elementA.selector) || isHeaderOrNav(elementB.selector)) {
      return false; 
    }
    
    // Check if either element is a generic container
    if (this.isContainerElement(elementA.selector) || this.isContainerElement(elementB.selector)) {
      return true;
    }
    
    // Check for parent-child relationships
    if (this.isParentChildOverlap(elementA, elementB)) {
      return true;
    }
    
    // Check for normal flow overlaps
    return this.isNormalFlowOverlap(elementA, elementB, overlap);
  }

  /**
   * Create element location object from element data
   */
  private createElementLocation(element: ElementWithBounds): ElementLocation {
    return {
      selector: element.selector,
      x: element.bounds.x,
      y: element.bounds.y,
      width: element.bounds.width,
      height: element.bounds.height,
      ...(element.textContent ? { textContent: element.textContent } : {}),
    };
  }
  
  /**
   * Create issue message based on overlapping elements
   */
  private createOverlapMessage(
    elementA: ElementWithBounds, 
    elementB: ElementWithBounds, 
    percentage: number
  ): string {
    const formattedPercentage = percentage.toFixed(1);
    
    if (elementA.textContent && elementB.textContent) {
      return `Elements "${elementA.textContent}" and "${elementB.textContent}" overlap by ${formattedPercentage}%`;
    } 
    
    if (elementA.textContent) {
      return `Element "${elementA.textContent}" and ${elementB.selector} overlap by ${formattedPercentage}%`;
    } 
    
    if (elementB.textContent) {
      return `Element ${elementA.selector} and "${elementB.textContent}" overlap by ${formattedPercentage}%`;
    } 
    
    return `Elements ${elementA.selector} and ${elementB.selector} overlap by ${formattedPercentage}%`;
  }
  
  /**
   * Process a detected overlap and create an issue if necessary
   */
  private processOverlap(
    elementA: ElementWithBounds, 
    elementB: ElementWithBounds, 
    overlap: ReturnType<typeof calculateOverlapArea>
  ): OverlapIssue | null {
    // Check for navigation/header elements first - we never want to miss these
    const isNavOrHeader = (selector: string): boolean => {
      return selector.includes('header') || 
             selector.includes('nav') || 
             selector.includes('menu') || 
             selector.includes('navigation') ||
             selector.includes('navbar') ||
             selector.includes('logo') ||
             selector.includes('brand');
    };
    
    // Use a lower threshold for navigation elements (1%) to catch even small overlaps in navs
    const isNavOverlap = isNavOrHeader(elementA.selector) || isNavOrHeader(elementB.selector);
    const navThreshold = 1;  // 1% for navigation elements
    
    // Skip if no overlap or below appropriate threshold
    if (!overlap || (isNavOverlap ? overlap.percentage < navThreshold : overlap.percentage < this.minOverlapPercentage)) {
      return null;
    }
    
    // Skip likely false positives UNLESS this is a navigation/header overlap
    if (!isNavOverlap && this.isLikelyFalsePositive(elementA, elementB, overlap)) {
      return null;
    }
    
    // Determine severity and create locations
    // Navigation overlaps are always considered critical
    const severity = isNavOverlap ? "critical" : determineSeverity(overlap.percentage);
    
    const locations = [
      this.createElementLocation(elementA),
      this.createElementLocation(elementB)
    ];
    
    // Create message
    const message = this.createOverlapMessage(elementA, elementB, overlap.percentage);
    
    // Return the issue
    return {
      type: "overlap",
      severity,
      message,
      elements: locations,
      overlapArea: {
        width: overlap.width,
        height: overlap.height,
        percentage: overlap.percentage,
      },
    };
  }

  /**
   * Special detection for header and navigation overlap issues
   */
  private async detectHeaderOverlaps(page: Page): Promise<OverlapIssue[]> {
    try {
      // This uses a more direct approach to find header overlaps
      const headerOverlaps = await page.evaluate(() => {
        // Helper to create a selector
        const createSelector = (el: Element): string => {
          if (el.id) return `#${el.id}`;
          
          const tag = el.tagName.toLowerCase();
          const classList = Array.from(el.classList).slice(0, 2);
          const classStr = classList.length > 0 ? `.${classList.join('.')}` : '';
          
          return `${tag}${classStr}`;
        };
        
        // Function to get text content
        const getTextContent = (el: Element): string | undefined => {
          const text = el.textContent?.trim() || '';
          if (!text) return undefined;
          return text.length > 50 ? text.substring(0, 47) + '...' : text;
        };
        
        // Only find actual presentational elements that shouldn't overlap
        // Explicitly exclude container elements like header, nav, div, section, etc.
        const presentationalElements = Array.from(document.querySelectorAll(
          // Only include actual content elements, not structural containers
          'a, button, img, svg, h1, h2, h3, h4, h5, h6, p, span, li > a, .logo, .brand, [class*="button"], [class*="btn"], .nav-link, .menu-item, .brand-text'
        )).filter(el => {
          const rect = el.getBoundingClientRect();
          const styles = getComputedStyle(el);
          
          // Skip elements that aren't visible or are too small
          if (rect.height < 20 || rect.width < 20 || 
              styles.display === 'none' || 
              styles.visibility === 'hidden' ||
              parseFloat(styles.opacity) === 0) {
            return false;
          }
          
          // Skip elements that are meant to contain other elements
          const tagName = el.tagName.toLowerCase();
          if (['div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav'].includes(tagName)) {
            return false;
          }
          
          // Skip parent of the element is position:relative and element is position:absolute
          // This is a common pattern for intentional overlapping
          if (styles.position === 'absolute' && 
              el.parentElement && 
              getComputedStyle(el.parentElement).position === 'relative') {
            return false;
          }
          
          // We only care about elements in the header area (typically top 150px)
          return rect.top < 150;
        });
        
        // Find all visibly overlapping elements
        const issues: Array<{
          elements: Array<{
            selector: string;
            textContent?: string;
            x: number;
            y: number;
            width: number;
            height: number;
          }>;
          percentage: number;
          message: string;
        }> = [];
        
        // Compare every presentational element with every other presentational element
        for (let i = 0; i < presentationalElements.length; i++) {
          const elementA = presentationalElements[i];
          const rectA = elementA.getBoundingClientRect();
          
          for (let j = i + 1; j < presentationalElements.length; j++) {
            const elementB = presentationalElements[j];
            const rectB = elementB.getBoundingClientRect();
            
            // Skip common parent-child relationships that are expected to overlap
            if (elementA.contains(elementB) || elementB.contains(elementA)) {
              continue;
            }
            
            // Skip elements sharing the same parent when they're in normal flow
            // (likely intentionally adjacent elements)
            if (elementA.parentElement === elementB.parentElement) {
              const parentStyles = getComputedStyle(elementA.parentElement as Element);
              // If parent is a flex container, it's likely intentional layout
              if (parentStyles.display === 'flex' || parentStyles.display === 'grid') {
                continue;
              }
            }
            
            // Check for overlap
            const overlapX = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
            const overlapY = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
            
            if (overlapX > 0 && overlapY > 0) {
              const overlapArea = overlapX * overlapY;
              const areaA = rectA.width * rectA.height;
              const areaB = rectB.width * rectB.height;
              const smallerArea = Math.min(areaA, areaB);
              const percentage = (overlapArea / smallerArea) * 100;
              
              // Focus on meaningful overlaps between presentational elements
              if (percentage > 20) {
                const selectorA = createSelector(elementA);
                const selectorB = createSelector(elementB);
                
                // Get meaningful names for the elements
                const nameA = getTextContent(elementA) || 
                              (elementA.tagName.toLowerCase() === 'img' ? 'Image' : selectorA);
                const nameB = getTextContent(elementB) || 
                              (elementB.tagName.toLowerCase() === 'img' ? 'Image' : selectorB);
                
                // Create more descriptive messages for specific element types
                let message = '';
                
                if (elementA.tagName.toLowerCase() === 'img' && elementB.tagName.toLowerCase() !== 'img') {
                  message = `Image overlaps with "${nameB}" by ${percentage.toFixed(1)}%`;
                } else if (elementB.tagName.toLowerCase() === 'img' && elementA.tagName.toLowerCase() !== 'img') {
                  message = `"${nameA}" overlaps with image by ${percentage.toFixed(1)}%`;
                } else if (elementA.classList.contains('logo') || elementA.classList.contains('brand') ||
                           elementB.classList.contains('logo') || elementB.classList.contains('brand')) {
                  message = `Logo/brand element overlaps with navigation: "${nameA}" and "${nameB}" by ${percentage.toFixed(1)}%`;
                } else {
                  message = `Navigation elements overlap: "${nameA}" and "${nameB}" by ${percentage.toFixed(1)}%`;
                }
                
                issues.push({
                  elements: [
                    {
                      selector: selectorA,
                      textContent: getTextContent(elementA),
                      x: rectA.left,
                      y: rectA.top,
                      width: rectA.width,
                      height: rectA.height
                    },
                    {
                      selector: selectorB,
                      textContent: getTextContent(elementB),
                      x: rectB.left,
                      y: rectB.top,
                      width: rectB.width,
                      height: rectB.height
                    }
                  ],
                  percentage,
                  message
                });
              }
            }
          }
        }
        
        return issues;
      });
      
      // Convert to OverlapIssue format but take only the top 10 most significant overlaps
      const significantIssues = headerOverlaps
        .sort((a, b) => b.percentage - a.percentage) // Sort by descending percentage
        .slice(0, 10); // Take only top 10
      
      return significantIssues.map(issue => ({
        type: "overlap",
        severity: issue.percentage >= 50 ? "critical" : 
                 issue.percentage >= 25 ? "major" : "minor",
        message: issue.message,
        elements: issue.elements.map(el => ({
          selector: el.selector,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          ...(el.textContent ? { textContent: el.textContent } : {})
        })),
        overlapArea: {
          width: 0, // We don't have this info from the browser evaluation
          height: 0, // We don't have this info from the browser evaluation
          percentage: issue.percentage
        }
      }));
    } catch (error) {
      console.error("Error in special header detection:", error);
      return [];
    }
  }

  /**
   * Detect overlapping elements on the page
   */
  async detect(page: Page): Promise<Result<OverlapIssue[], OverlapError>> {
    try {
      let issues: OverlapIssue[] = [];
      
      // First, try the special header detection if enabled
      if (this.specialHeaderDetection) {
        console.log("Running special header/navigation overlap detection...");
        const headerIssues = await this.detectHeaderOverlaps(page);
        if (headerIssues.length > 0) {
          console.log(`Found ${headerIssues.length} header/navigation overlaps`);
          issues = issues.concat(headerIssues);
          
          // If we found header issues, just return them immediately
          // This is a workaround for a potential bug elsewhere
          return Ok(headerIssues);
        } else {
          console.log("No header/navigation overlaps detected");
        }
      }
      
      // Continue with regular detection
      const elementsResult = await getVisibleElements(page);
      if (elementsResult.err) {
        return Err(elementsResult.val);
      }

      const elements = elementsResult.val;
      const validElements = elements.filter(
        element => !this.shouldIgnoreElement(element.selector)
      );

      console.log(`Regular detection: found ${validElements.length} valid elements for overlap checking`);
      
      // Check for header or navigation elements in our filtered set
      const headerNavElements = validElements.filter(el => 
        el.selector.includes('header') || 
        el.selector.includes('nav') || 
        el.selector.includes('menu') || 
        el.selector.includes('logo') || 
        el.selector.includes('brand')
      );
      
      if (headerNavElements.length > 0) {
        console.log(`Found ${headerNavElements.length} header/nav elements in filtered set`);
      }
      
      // Compare each element with every other element
      for (let i = 0; i < validElements.length; i++) {
        const elementA = validElements[i];

        for (let j = i + 1; j < validElements.length; j++) {
          const elementB = validElements[j];
          const overlap = calculateOverlapArea(elementA, elementB);
          
          const issue = this.processOverlap(elementA, elementB, overlap);
          if (issue) {
            issues.push(issue);
          }
        }
      }

      console.log(`Total overlap issues found: ${issues.length}`);
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
