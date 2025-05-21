import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzePage, validateResult, type Detector } from "./analyzer";
import { Ok, Err } from "../types/ts-results";
import type { Issue, OverlapIssue, AuditResult } from "../types/issues";
import type { Page } from "playwright-core";
import type { Config } from "../types/config";

// Mock the Page type from Playwright
const createMockPage = (): Page => {
  return {} as Page;
};

// Create a mock detector
const createMockDetector = (issues: Issue[] = [], shouldError = false): Detector => {
  return {
    detect: vi.fn().mockImplementation(async () => {
      if (shouldError) {
        return Err({ message: "Mock detector error" });
      }
      return Ok(issues);
    }),
  };
};

// URL constant to avoid duplicate strings
const TEST_URL = "https://example.com";

// Create a mock config
const createMockConfig = (): Config => {
  return {
    url: TEST_URL,
    viewport: {
      width: 1920,
      height: 1080,
    },
    format: "json",
  };
};

// Constants for mock elements
const ELEMENT_SIZE = {
  width: 100,
  height: 100,
};

// Create a mock issue
const createMockIssue = (): OverlapIssue => {
  return {
    type: "overlap",
    severity: "critical",
    message: "Elements are overlapping",
    elements: [
      {
        selector: ".element1",
        x: 0,
        y: 0,
        width: ELEMENT_SIZE.width,
        height: ELEMENT_SIZE.height,
      },
      {
        selector: ".element2",
        x: 50,
        y: 50,
        width: ELEMENT_SIZE.width,
        height: ELEMENT_SIZE.height,
      },
    ],
    overlapArea: {
      width: 50,
      height: 50,
      percentage: 25,
    },
  };
};

describe("analyzePage", () => {
  let mockPage: Page;
  let mockConfig: Config;

  beforeEach(() => {
    mockPage = createMockPage();
    mockConfig = createMockConfig();
  });

  it("should run detectors and aggregate results", async () => {
    // Arrange
    const mockIssue = createMockIssue();
    const detector1 = createMockDetector([mockIssue]);
    const detector2 = createMockDetector([]);

    // Act
    const result = await analyzePage(mockPage, mockConfig, [detector1, detector2]);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.issues).toHaveLength(1);
      expect(result.val.metadata.totalIssuesFound).toBe(1);
      expect(result.val.metadata.criticalIssues).toBe(1);
      expect(result.val.metadata.issuesByType.overlap).toBe(1);
      expect(detector1.detect).toHaveBeenCalledWith(mockPage);
      expect(detector2.detect).toHaveBeenCalledWith(mockPage);
    }
  });

  it("should return error if a detector fails", async () => {
    // Arrange
    const detector1 = createMockDetector([], true);
    const detector2 = createMockDetector([]);

    // Act
    const result = await analyzePage(mockPage, mockConfig, [detector1, detector2]);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val.message).toBe("Mock detector error");
    }
    expect(detector1.detect).toHaveBeenCalledWith(mockPage);
    expect(detector2.detect).not.toHaveBeenCalled();
  });

  it("should handle empty detector list", async () => {
    // Act
    const result = await analyzePage(mockPage, mockConfig, []);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.issues).toHaveLength(0);
      expect(result.val.metadata.totalIssuesFound).toBe(0);
    }
  });

  it("should count issues by severity", async () => {
    // Arrange
    const criticalIssue = createMockIssue();
    const majorIssue: Issue = { ...createMockIssue(), severity: "major" };
    const minorIssue: Issue = { ...createMockIssue(), severity: "minor" };

    const detector = createMockDetector([criticalIssue, majorIssue, minorIssue]);

    // Act
    const result = await analyzePage(mockPage, mockConfig, [detector]);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.metadata.totalIssuesFound).toBe(3);
      expect(result.val.metadata.criticalIssues).toBe(1);
      expect(result.val.metadata.majorIssues).toBe(1);
      expect(result.val.metadata.minorIssues).toBe(1);
    }
  });
});

describe("validateResult", () => {
  it("should return true for valid results", () => {
    // Arrange
    const validResult = {
      url: TEST_URL,
      timestamp: new Date().toISOString(),
      viewport: { width: 1920, height: 1080 },
      issues: [],
      metadata: {
        totalIssuesFound: 0,
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
        issuesByType: {
          overlap: 0,
          padding: 0,
          spacing: 0,
          "container-overflow": 0,
          scrollbar: 0,
          layout: 0,
          centering: 0,
        },
      },
    };

    // Act
    const result = validateResult(validResult);

    // Assert
    expect(result).toBe(true);
  });

  it("should return false for invalid results", () => {
    // Arrange
    const invalidResult = {
      url: TEST_URL,
      // Missing timestamp
      viewport: { width: 1920, height: 1080 },
      issues: [],
      metadata: {
        totalIssuesFound: 0,
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
        issuesByType: {},
      },
    };

    // Act
    const result = validateResult(invalidResult as unknown as AuditResult);

    // Assert
    expect(result).toBe(false);
  });
});
