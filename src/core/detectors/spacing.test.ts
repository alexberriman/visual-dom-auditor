import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpacingDetector } from "./spacing";
import { type Page } from "playwright-core";

// Mock Page object
const createMockPage = (): { page: Page } => {
  const page = {
    evaluate: vi.fn(),
    waitForTimeout: vi.fn(),
  } as unknown as Page;

  return { page };
};

describe("SpacingDetector", () => {
  let detector: SpacingDetector;
  let mockPage: Page;

  beforeEach(() => {
    const { page } = createMockPage();
    mockPage = page;
    detector = new SpacingDetector();
  });

  it("should return an empty array when no elements are found", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val).toEqual([]);
    }
  });

  // Constants for test cases
  const TEST_COORDS = {
    x: 10,
    y: 10,
    width: 100,
    height: 40,
  };
  const PARENT_SELECTOR = "nav.navbar";
  const NAV_ITEM_FIRST = "a.nav-item.first";
  const NAV_ITEM_SECOND = "a.nav-item.second";

  it("should detect insufficient horizontal spacing between inline elements", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: NAV_ITEM_FIRST,
        bounds: {
          x: TEST_COORDS.x,
          y: TEST_COORDS.y,
          width: TEST_COORDS.width,
          height: TEST_COORDS.height,
        },
        parent: PARENT_SELECTOR,
        isInline: true,
      },
      {
        selector: NAV_ITEM_SECOND,
        bounds: { x: 102, y: TEST_COORDS.y, width: TEST_COORDS.width, height: TEST_COORDS.height },
        parent: PARENT_SELECTOR,
        isInline: true,
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1);
      expect(result.val[0].type).toBe("spacing");
      expect(result.val[0].message).toContain("Horizontal spacing");
      expect(result.val[0].actualSpacing).toBe(-8); // 102 - (10 + 100) = -8px (overlapping)
      expect(result.val[0].recommendedSpacing).toBe(8); // Default minimum
    }
  });

  // Constants for block elements test
  const BLOCK_ELEMENT = {
    x: 10,
    width: 300,
    height: 200,
  };
  const BLOCK_PARENT = "div.container";

  it("should detect insufficient vertical spacing between block elements", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "div.card.first",
        bounds: {
          x: BLOCK_ELEMENT.x,
          y: 10,
          width: BLOCK_ELEMENT.width,
          height: BLOCK_ELEMENT.height,
        },
        parent: BLOCK_PARENT,
        isInline: false,
      },
      {
        selector: "div.card.second",
        bounds: {
          x: BLOCK_ELEMENT.x,
          y: 215,
          width: BLOCK_ELEMENT.width,
          height: BLOCK_ELEMENT.height,
        },
        parent: BLOCK_PARENT,
        isInline: false,
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1);
      expect(result.val[0].type).toBe("spacing");
      expect(result.val[0].message).toContain("Vertical spacing");
      expect(result.val[0].actualSpacing).toBe(5); // 215 - (10 + 200) = 5px
      expect(result.val[0].recommendedSpacing).toBe(12); // Default minimum
    }
  });

  it("should not report issues for elements with sufficient spacing", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "div.card.first",
        bounds: {
          x: BLOCK_ELEMENT.x,
          y: 10,
          width: BLOCK_ELEMENT.width,
          height: BLOCK_ELEMENT.height,
        },
        parent: BLOCK_PARENT,
        isInline: false,
      },
      {
        selector: "div.card.second",
        bounds: {
          x: BLOCK_ELEMENT.x,
          y: 230,
          width: BLOCK_ELEMENT.width,
          height: BLOCK_ELEMENT.height,
        },
        parent: BLOCK_PARENT,
        isInline: false,
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(0); // No issues - 20px spacing > 12px minimum
    }
  });

  // Constants for separator test
  const SEPARATOR_SELECTOR = "span.separator";
  const SEPARATOR_SIZE = {
    width: 20,
    height: 20,
  };

  it("should ignore elements in the ignored list", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: SEPARATOR_SELECTOR,
        bounds: {
          x: TEST_COORDS.x,
          y: TEST_COORDS.y,
          width: SEPARATOR_SIZE.width,
          height: SEPARATOR_SIZE.height,
        },
        parent: PARENT_SELECTOR,
        isInline: true,
      },
      {
        selector: "a.nav-item",
        bounds: { x: 12, y: TEST_COORDS.y, width: TEST_COORDS.width, height: TEST_COORDS.height }, // position offset slightly
        parent: PARENT_SELECTOR,
        isInline: true,
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(0); // No issues because one is ignored
    }
  });

  // Constants for button test
  const BTN_GROUP = "div.btn-group";

  it("should mark zero spacing as critical severity", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "button.btn.first",
        bounds: {
          x: TEST_COORDS.x,
          y: TEST_COORDS.y,
          width: TEST_COORDS.width,
          height: TEST_COORDS.height,
        },
        parent: BTN_GROUP,
        isInline: true,
      },
      {
        selector: "button.btn.second",
        bounds: { x: 110, y: TEST_COORDS.y, width: TEST_COORDS.width, height: TEST_COORDS.height },
        parent: BTN_GROUP,
        isInline: true,
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1);
      expect(result.val[0].severity).toBe("critical");
    }
  });

  // Constants for grouped elements test
  const LIST_PARENT = "ul.list";
  const LIST_HEIGHT = 30;
  const LIST_ITEM_FIRST = "li.item.first";
  const LIST_ITEM_SECOND = "li.item.second";

  it("should group elements by parent container", async () => {
    // Setup - two different parent containers with insufficient spacing
    mockPage.evaluate = vi.fn().mockResolvedValue([
      // First container
      {
        selector: NAV_ITEM_FIRST,
        bounds: {
          x: TEST_COORDS.x,
          y: TEST_COORDS.y,
          width: TEST_COORDS.width,
          height: TEST_COORDS.height,
        },
        parent: PARENT_SELECTOR,
        isInline: true,
      },
      {
        selector: NAV_ITEM_SECOND,
        bounds: { x: 115, y: TEST_COORDS.y, width: TEST_COORDS.width, height: TEST_COORDS.height },
        parent: PARENT_SELECTOR,
        isInline: true,
      },
      // Second container
      {
        selector: LIST_ITEM_FIRST,
        bounds: { x: TEST_COORDS.x, y: 100, width: TEST_COORDS.width, height: LIST_HEIGHT },
        parent: LIST_PARENT,
        isInline: true,
      },
      {
        selector: LIST_ITEM_SECOND,
        bounds: { x: 112, y: 100, width: TEST_COORDS.width, height: LIST_HEIGHT },
        parent: LIST_PARENT,
        isInline: true,
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(2); // One issue from each container
      expect(result.val[0].elements[0].selector).toContain("nav-item");
      expect(result.val[1].elements[0].selector).toContain("item");
    }
  });

  it("should handle page evaluation errors", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockRejectedValue(new Error("Evaluation failed"));

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val.message).toContain("Failed to");
    }
  });

  // Constants for custom thresholds test
  const CUSTOM_THRESHOLDS = {
    horizontal: 16,
    vertical: 24,
  };
  const SECOND_ELEMENT_X = 124; // Position for second element with 14px gap

  it("should support custom spacing thresholds", async () => {
    // Setup with custom minimum spacing
    const customDetector = new SpacingDetector({
      minimumHorizontalSpacingPx: CUSTOM_THRESHOLDS.horizontal,
      minimumVerticalSpacingPx: CUSTOM_THRESHOLDS.vertical,
    });

    mockPage.evaluate = vi.fn().mockResolvedValue([
      // Horizontal spacing that would be acceptable with defaults (12px) but not with custom (16px)
      {
        selector: NAV_ITEM_FIRST,
        bounds: {
          x: TEST_COORDS.x,
          y: TEST_COORDS.y,
          width: TEST_COORDS.width,
          height: TEST_COORDS.height,
        },
        parent: PARENT_SELECTOR,
        isInline: true,
      },
      {
        selector: NAV_ITEM_SECOND,
        bounds: {
          x: SECOND_ELEMENT_X,
          y: TEST_COORDS.y,
          width: TEST_COORDS.width,
          height: TEST_COORDS.height,
        },
        parent: PARENT_SELECTOR,
        isInline: true,
      },
    ]);

    // Execute
    const result = await customDetector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1); // Should detect issue with custom threshold
      expect(result.val[0].actualSpacing).toBe(14); // 124 - (10 + 100) = 14px
      expect(result.val[0].recommendedSpacing).toBe(16); // Custom minimum
    }
  });
});
