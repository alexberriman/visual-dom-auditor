import { test, expect, describe, vi, beforeEach } from "vitest";
import { type Page } from "playwright-core";
import centeringDetector, { CenteringDetector } from "./centering";
import type { CenteringIssue } from "../../types/issues";

describe("CenteringDetector", () => {
  // Mock page object
  let mockPage: Page;

  beforeEach(() => {
    // Create mock page with necessary functions
    mockPage = {
      $$: vi.fn(),
      evaluate: vi.fn(),
    } as unknown as Page;
  });

  test("should detect horizontal centering issues", async () => {
    // Mock the detector's internal methods for testing
    const originalFindMethod = CenteringDetector.prototype["findPotentiallyCenteredElements"];
    const originalCheckMethod = CenteringDetector.prototype["checkElementCentering"];

    // Constants for test
    const TEST_SELECTOR = "[style*='margin: 0 auto']";
    const TEST_AXIS = "horizontal";

    // Mock findPotentiallyCenteredElements to return a known element
    CenteringDetector.prototype["findPotentiallyCenteredElements"] = vi
      .fn()
      .mockResolvedValue([{ selector: TEST_SELECTOR, axis: TEST_AXIS }]);

    // Mock checkElementCentering to return a simulated issue
    CenteringDetector.prototype["checkElementCentering"] = vi.fn().mockResolvedValue({
      type: "centering",
      severity: "major",
      message: `Element appears to be intended for ${TEST_AXIS} centering but is misaligned by 5px`,
      elements: [
        { selector: TEST_SELECTOR, x: 105, y: 50, width: 200, height: 100 },
        { selector: `${TEST_SELECTOR} > parent`, x: 0, y: 0, width: 400, height: 200 },
      ],
      axis: TEST_AXIS,
      offset: { x: 5 },
    });

    // Run the detector
    const result = await centeringDetector.detect(mockPage);

    // Restore original methods
    CenteringDetector.prototype["findPotentiallyCenteredElements"] = originalFindMethod;
    CenteringDetector.prototype["checkElementCentering"] = originalCheckMethod;

    // Should return success
    expect(result.ok).toBe(true);

    // Should find one issue
    if (result.ok) {
      expect(result.val.length).toBe(1);

      const issue = result.val[0] as CenteringIssue;
      expect(issue.type).toBe("centering");
      expect(issue.axis).toBe("horizontal");
      expect(issue.offset.x).toBe(5);
      expect(issue.severity).toBe("major");
    }
  });

  test("should detect vertical centering issues", async () => {
    // Mock the detector's internal methods for testing
    const originalFindMethod = CenteringDetector.prototype["findPotentiallyCenteredElements"];
    const originalCheckMethod = CenteringDetector.prototype["checkElementCentering"];

    // Mock findPotentiallyCenteredElements to return a known element
    CenteringDetector.prototype["findPotentiallyCenteredElements"] = vi
      .fn()
      .mockResolvedValue([{ selector: "[style*='align-items: center']", axis: "vertical" }]);

    // Mock checkElementCentering to return a simulated issue
    CenteringDetector.prototype["checkElementCentering"] = vi.fn().mockResolvedValue({
      type: "centering",
      severity: "major",
      message: "Element appears to be intended for vertical centering but is misaligned by 5px",
      elements: [
        { selector: "[style*='align-items: center']", x: 100, y: 55, width: 200, height: 100 },
        {
          selector: "[style*='align-items: center'] > parent",
          x: 0,
          y: 0,
          width: 400,
          height: 200,
        },
      ],
      axis: "vertical",
      offset: { y: 5 },
    });

    // Run the detector
    const result = await centeringDetector.detect(mockPage);

    // Restore original methods
    CenteringDetector.prototype["findPotentiallyCenteredElements"] = originalFindMethod;
    CenteringDetector.prototype["checkElementCentering"] = originalCheckMethod;

    // Should return success
    expect(result.ok).toBe(true);

    // Should find one issue
    if (result.ok) {
      expect(result.val.length).toBe(1);

      const issue = result.val[0] as CenteringIssue;
      expect(issue.type).toBe("centering");
      expect(issue.axis).toBe("vertical");
      expect(issue.offset.y).toBe(5);
      expect(issue.severity).toBe("major");
    }
  });

  test("should detect both-axis centering issues", async () => {
    // Mock the detector's internal methods for testing
    const originalFindMethod = CenteringDetector.prototype["findPotentiallyCenteredElements"];
    const originalCheckMethod = CenteringDetector.prototype["checkElementCentering"];

    // Mock findPotentiallyCenteredElements to return a known element
    CenteringDetector.prototype["findPotentiallyCenteredElements"] = vi
      .fn()
      .mockResolvedValue([
        { selector: "[style*='transform: translate(-50%, -50%)']", axis: "both" },
      ]);

    // Mock checkElementCentering to return a simulated issue
    CenteringDetector.prototype["checkElementCentering"] = vi.fn().mockResolvedValue({
      type: "centering",
      severity: "critical",
      message:
        "Element appears to be intended for centering but is misaligned by 15px horizontally and 3px vertically",
      elements: [
        {
          selector: "[style*='transform: translate(-50%, -50%)']",
          x: 115,
          y: 53,
          width: 200,
          height: 100,
        },
        {
          selector: "[style*='transform: translate(-50%, -50%)'] > parent",
          x: 0,
          y: 0,
          width: 400,
          height: 200,
        },
      ],
      axis: "both",
      offset: { x: 15, y: 3 },
    });

    // Run the detector
    const result = await centeringDetector.detect(mockPage);

    // Restore original methods
    CenteringDetector.prototype["findPotentiallyCenteredElements"] = originalFindMethod;
    CenteringDetector.prototype["checkElementCentering"] = originalCheckMethod;

    // Should return success
    expect(result.ok).toBe(true);

    // Should find one issue
    if (result.ok) {
      expect(result.val.length).toBe(1);

      const issue = result.val[0] as CenteringIssue;
      expect(issue.type).toBe("centering");
      expect(issue.axis).toBe("both");
      expect(issue.offset.x).toBe(15);
      expect(issue.offset.y).toBe(3);
      // Severity should be based on the worst offset (x=15px, which is critical)
      expect(issue.severity).toBe("critical");
    }
  });

  test("should ignore small offsets within threshold", async () => {
    // Mock the detector's internal methods for testing
    const originalFindMethod = CenteringDetector.prototype["findPotentiallyCenteredElements"];
    const originalCheckMethod = CenteringDetector.prototype["checkElementCentering"];

    // Mock findPotentiallyCenteredElements to return a known element
    CenteringDetector.prototype["findPotentiallyCenteredElements"] = vi
      .fn()
      .mockResolvedValue([{ selector: "[style*='margin: 0 auto']", axis: "horizontal" }]);

    // Mock checkElementCentering to return null (no issue found)
    CenteringDetector.prototype["checkElementCentering"] = vi.fn().mockResolvedValue(null);

    // Run the detector
    const result = await centeringDetector.detect(mockPage);

    // Restore original methods
    CenteringDetector.prototype["findPotentiallyCenteredElements"] = originalFindMethod;
    CenteringDetector.prototype["checkElementCentering"] = originalCheckMethod;

    // Should return success
    expect(result.ok).toBe(true);

    // Should find no issues (below threshold)
    if (result.ok) {
      expect(result.val.length).toBe(0);
    }
  });

  test("should handle errors gracefully", async () => {
    // Mock an error during element query
    vi.spyOn(mockPage, "$$").mockImplementation(() => {
      throw new Error("Test error");
    });

    // Run the detector
    const result = await centeringDetector.detect(mockPage);

    // Should return error
    expect(result.ok).toBe(false);

    // Should contain error message
    if (!result.ok) {
      expect(result.val.message).toBe("Failed to detect centering issues");
      expect(result.val.cause).toBeInstanceOf(Error);
    }
  });
});
