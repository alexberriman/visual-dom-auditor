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

// Helper to create test elements with padding
const createTestElement = (props: {
  selector: string;
  tagName: string;
  bounds: { x: number; y: number; width: number; height: number };
  padding: { top: number; right: number; bottom: number; left: number };
  display: string;
  textContent?: string;
  hasDimensions?: { width: boolean; height: boolean };
  classes?: string[];
}): {
  selector: string;
  tagName: string;
  textContent?: string;
  bounds: { x: number; y: number; width: number; height: number };
  padding: { top: number; right: number; bottom: number; left: number };
  display: string;
  hasDimensions: { width: boolean; height: boolean };
  styleInfo: {
    explicit: {
      width: null;
      height: null;
      padding: {
        top: null;
        right: null;
        bottom: null;
        left: null;
      };
    };
    computed: {
      width: string;
      height: string;
      paddingTop: string;
      paddingRight: string;
      paddingBottom: string;
      paddingLeft: string;
      boxSizing: string;
    };
    classes: string[];
  };
} => {
  const {
    selector,
    tagName,
    bounds,
    padding,
    display,
    textContent,
    hasDimensions = { width: false, height: false },
    classes = [],
  } = props;

  return {
    selector,
    tagName,
    textContent,
    bounds,
    padding,
    display,
    hasDimensions,
    styleInfo: {
      explicit: {
        width: null,
        height: null,
        padding: {
          top: null,
          right: null,
          bottom: null,
          left: null,
        },
      },
      computed: {
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        paddingTop: `${padding.top}px`,
        paddingRight: `${padding.right}px`,
        paddingBottom: `${padding.bottom}px`,
        paddingLeft: `${padding.left}px`,
        boxSizing: "content-box",
      },
      classes: classes.length > 0 ? classes : selector.split(".").filter((s) => s !== ""),
    },
  };
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
      createTestElement({
        selector: "button.primary",
        tagName: "button",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        display: "inline-block",
        classes: ["primary"],
      }),
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
      createTestElement({
        selector: ".card",
        tagName: "div",
        bounds: { x: 10, y: 10, width: 300, height: 200 },
        padding: { top: 4, right: 12, bottom: 4, left: 12 },
        display: "block",
        classes: ["card"],
      }),
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
      createTestElement({
        selector: "button.primary",
        tagName: "button",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
        display: "inline-block",
        classes: ["primary"],
      }),
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
      createTestElement({
        selector: ".card",
        tagName: "div",
        bounds: { x: 10, y: 10, width: 300, height: 200 },
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
        display: "block",
      }),
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
      createTestElement({
        selector: ".icon.close",
        tagName: "span",
        bounds: { x: 10, y: 10, width: 20, height: 20 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        display: "inline-block",
        classes: ["icon", "close"],
      }),
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
      createTestElement({
        selector: "a.btn",
        tagName: "a",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        display: "block",
        classes: ["btn"],
      }),
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
      createTestElement({
        selector: ".card",
        tagName: "div",
        bounds: { x: 10, y: 10, width: 300, height: 200 },
        padding: { top: 12, right: 12, bottom: 12, left: 12 },
        display: "block",
        classes: ["card"],
      }),
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

  it("should ignore links with display:inline", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      createTestElement({
        selector: "a.text-2xl.font-bold",
        tagName: "a",
        textContent: "example.com",
        bounds: { x: 10, y: 10, width: 100, height: 30 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        display: "inline",
        classes: ["text-2xl", "font-bold"],
      }),
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(0); // No issues because it's an inline link
    }
  });

  it("should detect padding issues on links with display:block", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      createTestElement({
        selector: "a.button",
        tagName: "a",
        textContent: "Click Me",
        bounds: { x: 10, y: 10, width: 100, height: 30 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        display: "block",
        classes: ["button"],
      }),
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

  it("should detect buttons with inline-flex display that have zero padding", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      createTestElement({
        selector: "button.inline-flex.items-center",
        tagName: "button",
        textContent: "Get Started",
        bounds: { x: 100, y: 20, width: 120, height: 40 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        display: "inline-flex",
        classes: ["inline-flex", "items-center"],
      }),
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
});
