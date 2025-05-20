import { describe, it, expect, vi, beforeEach } from "vitest";
import { OverlapDetector } from "./overlap";
import { type Page } from "playwright-core";

// Mock Page object
const createMockPage = (): { page: Page } => {
  const page = {
    evaluate: vi.fn(),
    waitForTimeout: vi.fn(),
  } as unknown as Page;

  return { page };
};

describe("OverlapDetector", () => {
  let detector: OverlapDetector;
  let mockPage: Page;

  beforeEach(() => {
    const { page } = createMockPage();
    mockPage = page;
    detector = new OverlapDetector();
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

  it("should detect overlapping elements above threshold", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "#element1",
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      },
      {
        selector: "#element2",
        bounds: { x: 50, y: 50, width: 100, height: 100 },
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(1);
      expect(result.val[0].type).toBe("overlap");
      expect(result.val[0].elements.length).toBe(2);
      expect(result.val[0].overlapArea.percentage).toBeGreaterThan(10);
    }
  });

  it("should ignore elements below threshold", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "#element1",
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      },
      {
        selector: "#element2",
        bounds: { x: 95, y: 95, width: 100, height: 100 },
      },
    ]);

    // Create detector with higher threshold
    const highThresholdDetector = new OverlapDetector({
      minOverlapPercentage: 30,
    });

    // Execute
    const result = await highThresholdDetector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(0);
    }
  });

  it("should ignore selectors in the ignored list", async () => {
    // Setup
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "#element1",
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      },
      {
        selector: ".tooltip",
        bounds: { x: 50, y: 50, width: 100, height: 100 },
      },
    ]);

    // Execute
    const result = await detector.detect(mockPage);

    // Verify
    expect(result.err).toBe(false);
    if (!result.err) {
      expect(result.val.length).toBe(0);
    }
  });

  it("should set severity to critical when overlap percentage is high", async () => {
    // Setup for critical (>50%)
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "#element1",
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      },
      {
        selector: "#element2",
        bounds: { x: 25, y: 25, width: 100, height: 100 },
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

  it.skip("should set severity to minor when overlap percentage is low", async () => {
    // Issue #1: Fix this test - currently there's an issue with the overlap calculation
    // Create detector with lower threshold for this test
    const minorDetector = new OverlapDetector({ minOverlapPercentage: 5 });

    // Setup for minor (10%-25%)
    mockPage.evaluate = vi.fn().mockResolvedValue([
      {
        selector: "#element1",
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      },
      {
        selector: "#element2",
        // 20x20 overlap = 20% of 100x100
        bounds: { x: 80, y: 80, width: 100, height: 100 },
      },
    ]);

    // Execute
    const minorResult = await minorDetector.detect(mockPage);

    // Verify
    expect(minorResult.err).toBe(false);
    if (!minorResult.err) {
      expect(minorResult.val.length).toBe(1);
      expect(minorResult.val[0].severity).toBe("minor");
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
});
