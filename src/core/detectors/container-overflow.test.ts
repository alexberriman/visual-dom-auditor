import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContainerOverflowDetector } from "./container-overflow";
import { type Page } from "playwright-core";

describe("ContainerOverflowDetector", () => {
  let mockPage: Page;
  let detector: ContainerOverflowDetector;

  beforeEach(() => {
    // Create a mock Page object with typed evaluate function
    mockPage = {
      evaluate: vi.fn(),
    } as unknown as Page;

    // Create detector with default options
    detector = new ContainerOverflowDetector();
  });

  it("should return an empty array when no container-child pairs are found", async () => {
    // Mock evaluate to return an empty array
    mockPage.evaluate = vi.fn().mockResolvedValue([]);

    // Execute the detector
    const result = await detector.detect(mockPage);

    // Verify result is Ok with an empty array
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });

  it("should detect a child that overflows its container", async () => {
    // Mock container-child pairs with an overflow case
    const mockPairs = [
      {
        parent: {
          selector: "div.container",
          bounds: { x: 100, y: 100, width: 200, height: 200 },
        },
        child: {
          selector: "div.child",
          bounds: { x: 100, y: 100, width: 250, height: 200 }, // Overflows right by 50px
        },
      },
    ];

    // Mock evaluate to return our test pairs
    mockPage.evaluate = vi.fn().mockResolvedValue(mockPairs);

    // Execute the detector
    const result = await detector.detect(mockPage);

    // Verify result
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.length).toBe(1);
      expect(result.val[0].type).toBe("container-overflow");
      expect(result.val[0].elements.length).toBe(2);
      expect(result.val[0].overflowAmount.right).toBe(50);
      expect(result.val[0].severity).toBe("major"); // Based on 25% overflow (50px / 200px)
    }
  });

  it("should detect multiple overflow sides", async () => {
    // Mock container-child pairs with overflow on multiple sides
    const mockPairs = [
      {
        parent: {
          selector: "div.container",
          bounds: { x: 100, y: 100, width: 200, height: 100 },
        },
        child: {
          selector: "div.child",
          bounds: { x: 80, y: 90, width: 240, height: 130 }, // Overflows left, right, and bottom
        },
      },
    ];

    // Mock evaluate to return our test pairs
    mockPage.evaluate = vi.fn().mockResolvedValue(mockPairs);

    // Execute the detector
    const result = await detector.detect(mockPage);

    // Verify result
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.length).toBe(1);
      expect(result.val[0].overflowAmount.left).toBe(20);
      expect(result.val[0].overflowAmount.right).toBe(20);
      expect(result.val[0].overflowAmount.bottom).toBe(20);
      expect(result.val[0].overflowAmount.top).toBe(10); // There is a top overflow of 10px
    }
  });

  it("should ignore elements with selectors in the ignore list", async () => {
    // Create detector with custom ignore list
    detector = new ContainerOverflowDetector({
      ignoredSelectors: [".ignore-me"],
    });

    // Mock container-child pairs with an element that should be ignored
    const mockPairs = [
      {
        parent: {
          selector: "div.container",
          bounds: { x: 100, y: 100, width: 200, height: 200 },
        },
        child: {
          selector: "div.ignore-me",
          bounds: { x: 50, y: 50, width: 300, height: 300 }, // Significant overflow
        },
      },
    ];

    // Mock evaluate to return our test pairs
    mockPage.evaluate = vi.fn().mockResolvedValue(mockPairs);

    // Execute the detector
    const result = await detector.detect(mockPage);

    // Verify result - should be empty as we're ignoring the only pair
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });

  it("should handle evaluation errors", async () => {
    // Mock evaluate to throw an error
    const testError = new Error("Test error");
    mockPage.evaluate = vi.fn().mockRejectedValue(testError);

    // Execute the detector
    const result = await detector.detect(mockPage);

    // Verify result is Err
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val.message).toContain("Failed to get container-child pairs");
      expect(result.val.cause).toBe(testError);
    }
  });

  it("should apply minimum overflow threshold", async () => {
    // Create detector with higher minimum threshold
    detector = new ContainerOverflowDetector({
      minOverflowPx: 30,
    });

    // Mock container-child pairs with a minor overflow case
    const mockPairs = [
      {
        parent: {
          selector: "div.container",
          bounds: { x: 100, y: 100, width: 200, height: 200 },
        },
        child: {
          selector: "div.child",
          bounds: { x: 100, y: 100, width: 220, height: 200 }, // Overflows right by 20px
        },
      },
    ];

    // Mock evaluate to return our test pairs
    mockPage.evaluate = vi.fn().mockResolvedValue(mockPairs);

    // Execute the detector
    const result = await detector.detect(mockPage);

    // Verify result - should be empty as overflow is below threshold
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual([]);
    }
  });
});
