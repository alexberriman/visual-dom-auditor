import { describe, test, expect, vi, beforeEach } from "vitest";
import { type Page } from "playwright-core";
import { ScrollbarDetector } from "./scrollbar";

// Mock the page object
const createMockPage = () => {
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
    vi.mocked(mockPage.evaluate).mockResolvedValue({
      horizontal: null,
      vertical: null,
    });

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });

  test("should detect horizontal scrollbar issues", async () => {
    // Mock evaluation returning a horizontal scrollbar
    vi.mocked(mockPage.evaluate).mockResolvedValue({
      horizontal: {
        direction: "horizontal",
        viewport: {
          width: 1000,
          height: 800,
        },
        documentSize: {
          width: 1200,
          height: 1500,
        },
        causingElement: {
          selector: "div.content",
          bounds: {
            x: 50,
            y: 100,
            width: 1150,
            height: 300,
          },
        },
      },
      vertical: null,
    });

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const issues = result.val;
      expect(issues.length).toBe(1);
      expect(issues[0].type).toBe("scrollbar");
      expect(issues[0].direction).toBe("horizontal");
      expect(issues[0].severity).toBe("major");
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
    vi.mocked(mockPage.evaluate).mockResolvedValue({
      horizontal: {
        direction: "horizontal",
        viewport: {
          width: 1000,
          height: 800,
        },
        documentSize: {
          width: 1200,
          height: 1500,
        },
        causingElement: {
          selector: "div.content",
          bounds: {
            x: 50,
            y: 100,
            width: 1150,
            height: 300,
          },
        },
      },
      vertical: null,
    });

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });

  test("should not report vertical scrollbar when expected", async () => {
    // Mock evaluation returning only a vertical scrollbar
    vi.mocked(mockPage.evaluate).mockResolvedValue({
      horizontal: null,
      vertical: {
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
    });

    // With default settings (expectVerticalScrollbar = true)
    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });

  test("should report unexpected vertical scrollbar when not expected", async () => {
    // Create detector that doesn't expect vertical scrollbars
    detector = new ScrollbarDetector({
      expectVerticalScrollbar: false,
    });

    // Mock evaluation returning only a vertical scrollbar
    vi.mocked(mockPage.evaluate).mockResolvedValue({
      horizontal: null,
      vertical: {
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
    });

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const issues = result.val;
      expect(issues.length).toBe(1);
      expect(issues[0].type).toBe("scrollbar");
      expect(issues[0].direction).toBe("vertical");
      expect(issues[0].severity).toBe("minor");
    }
  });

  test("should handle evaluation errors", async () => {
    // Mock evaluation throwing an error
    vi.mocked(mockPage.evaluate).mockRejectedValue(new Error("Evaluation failed"));

    const result = await detector.detect(mockPage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val.message).toBe("Failed to detect scrollbar issues");
    }
  });
});
