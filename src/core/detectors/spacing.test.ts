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

  it("should detect insufficient horizontal spacing between inline elements", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "a.nav-item.first",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        parent: "nav.navbar",
        isInline: true,
      },
      {
        selector: "a.nav-item.second",
        bounds: { x: 102, y: 10, width: 100, height: 40 },
        parent: "nav.navbar",
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

  it("should detect insufficient vertical spacing between block elements", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "div.card.first",
        bounds: { x: 10, y: 10, width: 300, height: 200 },
        parent: "div.container",
        isInline: false,
      },
      {
        selector: "div.card.second",
        bounds: { x: 10, y: 215, width: 300, height: 200 },
        parent: "div.container",
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
        bounds: { x: 10, y: 10, width: 300, height: 200 },
        parent: "div.container",
        isInline: false,
      },
      {
        selector: "div.card.second",
        bounds: { x: 10, y: 230, width: 300, height: 200 },
        parent: "div.container",
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

  it("should ignore elements in the ignored list", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "span.separator",
        bounds: { x: 10, y: 10, width: 20, height: 20 },
        parent: "nav.navbar",
        isInline: true,
      },
      {
        selector: "a.nav-item",
        bounds: { x: 12, y: 10, width: 100, height: 40 },
        parent: "nav.navbar",
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

  it("should mark zero spacing as critical severity", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "button.btn.first",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        parent: "div.btn-group",
        isInline: true,
      },
      {
        selector: "button.btn.second",
        bounds: { x: 110, y: 10, width: 100, height: 40 },
        parent: "div.btn-group",
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

  it("should group elements by parent container", async () => {
    // Setup - two different parent containers with insufficient spacing
    mockPage.evaluate = vi.fn().mockResolvedValue([
      // First container
      {
        selector: "a.nav-item.first",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        parent: "nav.navbar",
        isInline: true,
      },
      {
        selector: "a.nav-item.second",
        bounds: { x: 115, y: 10, width: 100, height: 40 },
        parent: "nav.navbar",
        isInline: true,
      },
      // Second container
      {
        selector: "li.item.first",
        bounds: { x: 10, y: 100, width: 100, height: 30 },
        parent: "ul.list",
        isInline: true,
      },
      {
        selector: "li.item.second",
        bounds: { x: 112, y: 100, width: 100, height: 30 },
        parent: "ul.list",
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

  it("should support custom spacing thresholds", async () => {
    // Setup with custom minimum spacing
    const customDetector = new SpacingDetector({
      minimumHorizontalSpacingPx: 16,
      minimumVerticalSpacingPx: 24,
    });

    mockPage.evaluate = vi.fn().mockResolvedValue([
      // Horizontal spacing that would be acceptable with defaults (12px) but not with custom (16px)
      {
        selector: "a.nav-item.first",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        parent: "nav.navbar",
        isInline: true,
      },
      {
        selector: "a.nav-item.second",
        bounds: { x: 124, y: 10, width: 100, height: 40 },
        parent: "nav.navbar",
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
