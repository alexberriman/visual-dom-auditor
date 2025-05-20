import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaddingDetector } from "./padding";
import { type Page } from "playwright-core";

// Mock Page object
const createMockPage = (): { page: Page } => {
  const page = {
    evaluate: vi.fn(),
    waitForTimeout: vi.fn(),
  } as unknown as Page;

  return { page };
};

describe("PaddingDetector", () => {
  let detector: PaddingDetector;
  let mockPage: Page;

  beforeEach(() => {
    const { page } = createMockPage();
    mockPage = page;
    detector = new PaddingDetector();
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

  it("should detect buttons with zero padding", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "button.primary",
        tagName: "button",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1);
      expect(result.val[0].type).toBe("padding");
      expect(result.val[0].severity).toBe("critical");
      expect(result.val[0].sides).toContain("top");
      expect(result.val[0].sides).toContain("right");
      expect(result.val[0].sides).toContain("bottom");
      expect(result.val[0].sides).toContain("left");
    }
  });

  it("should detect elements with insufficient padding", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: ".card",
        tagName: "div",
        bounds: { x: 10, y: 10, width: 300, height: 200 },
        padding: { top: 4, right: 12, bottom: 4, left: 12 },
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1);
      expect(result.val[0].type).toBe("padding");
      expect(result.val[0].sides).toContain("top");
      expect(result.val[0].sides).toContain("bottom");
      expect(result.val[0].sides).not.toContain("right");
      expect(result.val[0].sides).not.toContain("left");
    }
  });

  it("should apply stricter requirements for important interactive elements", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "button.primary",
        tagName: "button",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1); // Should detect issue because buttons need more padding
      expect(result.val[0].sides.length).toBe(4); // All sides have insufficient padding for buttons
    }
  });

  it("should not report issues for elements with sufficient padding", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: ".card",
        tagName: "div",
        bounds: { x: 10, y: 10, width: 300, height: 200 },
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(0); // No issues
    }
  });

  it("should ignore elements in the ignored list", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: ".icon.close",
        tagName: "span",
        bounds: { x: 10, y: 10, width: 20, height: 20 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(0); // No issues because it's ignored
    }
  });

  it("should mark severe issues as critical", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "a.btn",
        tagName: "a",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
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

  it("should support custom minimum padding thresholds", async () => {
    // Setup with custom minimum padding
    const customDetector = new PaddingDetector({
      minimumPaddingPx: 16,
    });

    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: ".card",
        tagName: "div",
        bounds: { x: 10, y: 10, width: 300, height: 200 },
        padding: { top: 12, right: 12, bottom: 12, left: 12 },
      },
    ]);

    // Execute
    const result = await customDetector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1); // Should detect issue with custom threshold
      expect(result.val[0].sides.length).toBe(4); // All sides have insufficient padding
    }
  });
});
