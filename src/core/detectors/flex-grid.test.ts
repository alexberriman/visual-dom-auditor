import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlexGridLayoutDetector } from "./flex-grid";
import type { Page } from "playwright-core";

// Mock Page object
const createMockPage = (): { evaluate: ReturnType<typeof vi.fn> } => ({
  evaluate: vi.fn(),
});

// Type for our mock page
type MockPage = {
  evaluate: ReturnType<typeof vi.fn>;
};

describe("FlexGridLayoutDetector", () => {
  let detector: FlexGridLayoutDetector;
  let mockPage: MockPage;

  beforeEach(() => {
    detector = new FlexGridLayoutDetector();
    mockPage = createMockPage();
  });

  it("should return empty array when no flex/grid elements found", async () => {
    // Mock the page.evaluate to return empty array
    mockPage.evaluate.mockResolvedValue([]);

    const result = await detector.detect(mockPage as unknown as Page);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }

    expect(mockPage.evaluate).toHaveBeenCalled();
  });

  it("should detect flex layout issues with missing flex-wrap", async () => {
    // Mock a flex container with children that would overflow without wrap
    mockPage.evaluate.mockResolvedValue([
      {
        selector: ".flex-container",
        bounds: { x: 0, y: 0, width: 300, height: 100 },
        layoutType: "flex",
        style: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
        },
        children: [
          {
            selector: ".child-1",
            bounds: { x: 0, y: 0, width: 150, height: 100 },
            style: { flexGrow: "0", flexShrink: "1" },
          },
          {
            selector: ".child-2",
            bounds: { x: 150, y: 0, width: 150, height: 100 },
            style: { flexGrow: "0", flexShrink: "1" },
          },
          {
            selector: ".child-3",
            bounds: { x: 300, y: 0, width: 150, height: 100 },
            style: { flexGrow: "0", flexShrink: "1" },
          },
          {
            selector: ".child-4",
            bounds: { x: 450, y: 0, width: 150, height: 100 },
            style: { flexGrow: "0", flexShrink: "1" },
          },
        ],
      },
    ]);

    const result = await detector.detect(mockPage as unknown as Page);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.length).toBeGreaterThan(0);
      expect(result.val[0].type).toBe("layout");
      expect(result.val[0].layoutType).toBe("flex");
      expect(result.val[0].problems).toContain("children overflow container without flex-wrap");
    }
  });

  it("should detect flex layout issues with squeezed items", async () => {
    // Mock a flex container with squeezed children
    mockPage.evaluate.mockResolvedValue([
      {
        selector: ".flex-container",
        bounds: { x: 0, y: 0, width: 100, height: 50 },
        layoutType: "flex",
        style: {
          display: "flex",
          flexDirection: "row",
        },
        children: [
          {
            selector: ".child-1",
            bounds: { x: 0, y: 0, width: 50, height: 50 },
            style: { flexGrow: "0", flexShrink: "1" },
          },
          {
            selector: ".child-2",
            bounds: { x: 50, y: 0, width: 5, height: 50 }, // Very narrow!
            style: { flexGrow: "0", flexShrink: "1" },
          },
        ],
      },
    ]);

    const detector = new FlexGridLayoutDetector({ minChildWidth: 10 });
    const result = await detector.detect(mockPage as unknown as Page);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.length).toBeGreaterThan(0);
      expect(result.val[0].problems).toContain(
        "some children are excessively squeezed (consider using min-width/min-height)"
      );
    }
  });

  it("should detect grid layout issues with inconsistent sizing", async () => {
    // Mock a grid container with inconsistently sized children
    mockPage.evaluate.mockResolvedValue([
      {
        selector: ".grid-container",
        bounds: { x: 0, y: 0, width: 300, height: 300 },
        layoutType: "grid",
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto",
        },
        children: [
          {
            selector: ".child-1",
            bounds: { x: 0, y: 0, width: 150, height: 100 },
            style: { gridColumn: "1", gridRow: "1" },
          },
          {
            selector: ".child-2",
            bounds: { x: 150, y: 0, width: 150, height: 200 }, // Different height
            style: { gridColumn: "2", gridRow: "1" },
          },
          {
            selector: ".child-3",
            bounds: { x: 0, y: 100, width: 75, height: 100 }, // Different width
            style: { gridColumn: "1", gridRow: "2" },
          },
        ],
      },
    ]);

    const result = await detector.detect(mockPage as unknown as Page);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.length).toBeGreaterThan(0);
      expect(result.val[0].type).toBe("layout");
      expect(result.val[0].layoutType).toBe("grid");
      expect(result.val[0].problems).toContain("grid items have inconsistent sizing");
    }
  });

  it("should ignore elements matching ignored selectors", async () => {
    // Mock a flex container with a class that should be ignored
    mockPage.evaluate.mockResolvedValue([
      {
        selector: ".icon-container",
        bounds: { x: 0, y: 0, width: 100, height: 50 },
        layoutType: "flex",
        style: {
          display: "flex",
          flexDirection: "row",
        },
        children: [
          {
            selector: ".icon-1",
            bounds: { x: 0, y: 0, width: 50, height: 50 },
            style: { flexGrow: "0", flexShrink: "1" },
          },
          {
            selector: ".icon-2",
            bounds: { x: 50, y: 0, width: 5, height: 50 }, // Very narrow!
            style: { flexGrow: "0", flexShrink: "1" },
          },
        ],
      },
    ]);

    // Create detector with custom ignored selectors
    const detector = new FlexGridLayoutDetector({
      ignoredSelectors: [".icon"],
    });

    const result = await detector.detect(mockPage as unknown as Page);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // No issues should be reported because the container is ignored
      expect(result.val.length).toBe(0);
    }
  });

  it("should handle evaluation errors gracefully", async () => {
    // Mock an error during page evaluation
    mockPage.evaluate.mockRejectedValue(new Error("Evaluation failed"));

    const result = await detector.detect(mockPage as unknown as Page);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val.message).toContain("Failed to get flex/grid layout elements");
      expect(result.val.cause).toBeDefined();
    }
  });

  it("should detect missing gap between grid items", async () => {
    // Mock a grid with no gap property
    mockPage.evaluate.mockResolvedValue([
      {
        selector: ".grid-container",
        bounds: { x: 0, y: 0, width: 300, height: 300 },
        layoutType: "grid",
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto",
          // No gap property
        },
        children: [
          {
            selector: ".child-1",
            bounds: { x: 0, y: 0, width: 150, height: 150 },
            style: { gridColumn: "1", gridRow: "1" },
          },
          {
            selector: ".child-2",
            bounds: { x: 150, y: 0, width: 150, height: 150 },
            style: { gridColumn: "2", gridRow: "1" },
          },
        ],
      },
    ]);

    const result = await detector.detect(mockPage as unknown as Page);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.length).toBeGreaterThan(0);
      expect(result.val[0].problems).toContain("grid layout missing gap property");
    }
  });
});
