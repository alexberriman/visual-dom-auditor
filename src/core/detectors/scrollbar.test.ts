import { describe, test, expect, vi, beforeEach } from "vitest";
import { type Page } from "playwright-core";
import { ScrollbarDetector } from "./scrollbar";

// Define a type for the mock evaluate function
type MockEvaluateFunction = {
  mockResolvedValue: (_value: unknown) => void;
  mockRejectedValue: (_error: Error) => void;
};

// Mock the page object
const createMockPage = (): Page => {
  return {
    evaluate: vi.fn(),
  } as unknown as Page;
};

describe("ScrollbarDetector", () => {
  let detector: ScrollbarDetector;
  let mockPage: Page;

  beforeEach(() => {
    mockPage = createMockPage();
    detector = new ScrollbarDetector();
    vi.clearAllMocks();
  });

  test("should return empty array when no scrollbars are detected", async () => {
    // Mock evaluation returning no scrollbars
    (mockPage.evaluate as unknown as MockEvaluateFunction).mockResolvedValue({
      horizontal: null,
      vertical: null,
    });

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });

  // Constants for test
  const CONTENT_SELECTOR = "div.content";
  const VIEWPORT_SIZE = {
    width: 1000,
    height: 800,
  };
  const DOCUMENT_SIZE = {
    width: 1200,
    height: 1500,
  };

  test("should detect horizontal scrollbar issues", async () => {
    // Mock evaluation returning a horizontal scrollbar
    (mockPage.evaluate as unknown as MockEvaluateFunction).mockResolvedValue([
      {
        direction: "horizontal",
        viewport: VIEWPORT_SIZE,
        documentSize: DOCUMENT_SIZE,
        causingElement: {
          selector: CONTENT_SELECTOR,
          bounds: {
            x: 50,
            y: 100,
            width: 1150,
            height: 300,
          },
        },
      },
    ]);

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const issues = result.val;
      expect(issues.length).toBe(1);
      expect(issues[0].type).toBe("scrollbar");
      expect(issues[0].direction).toBe("horizontal");
      expect(issues[0].severity).toBe("critical");
      expect(issues[0].elements.length).toBe(1);
      expect(issues[0].elements[0].selector).toBe("div.content");
    }
  });

  test("should ignore horizontal scrollbar from ignored selectors", async () => {
    // Create detector with custom ignored selectors
    detector = new ScrollbarDetector({
      ignoredSelectors: [".content", ".scrollable"],
    });

    // Mock evaluation returning a horizontal scrollbar with ignored element
    (mockPage.evaluate as unknown as MockEvaluateFunction).mockResolvedValue([
      {
        direction: "horizontal",
        viewport: VIEWPORT_SIZE,
        documentSize: DOCUMENT_SIZE,
        causingElement: {
          selector: CONTENT_SELECTOR,
          bounds: {
            x: 50,
            y: 100,
            width: 1150,
            height: 300,
          },
        },
      },
    ]);

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });

  test("should not report vertical scrollbar when expected", async () => {
    // Mock evaluation returning only a vertical scrollbar
    (mockPage.evaluate as unknown as MockEvaluateFunction).mockResolvedValue([
      {
        direction: "vertical",
        viewport: {
          width: 1000,
          height: 800,
        },
        documentSize: {
          width: 1000,
          height: 1500,
        },
      },
    ]);

    // With default settings (expectVerticalScrollbar = true)
    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });

  test("should not report vertical scrollbar (not considered an issue)", async () => {
    // Mock evaluation returning only a vertical scrollbar
    (mockPage.evaluate as unknown as MockEvaluateFunction).mockResolvedValue([
      {
        direction: "vertical",
        viewport: {
          width: 1000,
          height: 800,
        },
        documentSize: {
          width: 1000,
          height: 1500,
        },
      },
    ]);

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const issues = result.val;
      // Vertical scrollbars are not considered issues, so no issues should be reported
      expect(issues.length).toBe(0);
    }
  });

  test("should handle evaluation errors", async () => {
    // Mock evaluation throwing an error
    (mockPage.evaluate as unknown as MockEvaluateFunction).mockRejectedValue(
      new Error("Evaluation failed")
    );

    const result = await detector.detect(mockPage);
    // Updated expectation since we return Ok([]) for errors now
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });
});
