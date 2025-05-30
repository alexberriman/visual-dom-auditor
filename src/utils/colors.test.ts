import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  formatUrl,
  formatBrowser,
  shouldUseColors,
  conditionalFormat,
  createUrlPrefix,
  prefixWithUrl,
} from "./colors";

describe("colors utility", () => {
  const originalEnv = process.env;
  const originalIsTTY = process.stdout.isTTY;

  // ANSI escape character for color codes
  const ESC = String.fromCharCode(27);

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.CI;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
    });
  });

  describe("formatUrl", () => {
    it("should format a valid URL with domain extraction", () => {
      const result = formatUrl("https://example.com/path?query=1");
      expect(result).toContain("[example.com]");
      expect(result).toContain(ESC + "["); // Should contain ANSI codes
    });

    it("should handle URLs without protocol", () => {
      const result = formatUrl("example.com");
      expect(result).toContain("[example.com]");
    });

    it("should handle invalid URLs gracefully", () => {
      const result = formatUrl("not-a-url");
      expect(result).toContain("[not-a-url]");
    });

    it("should use consistent colors for the same URL", () => {
      const result1 = formatUrl("https://example.com/path");
      const result2 = formatUrl("https://example.com/path");

      // Extract color codes using dynamic regex to avoid ESLint control character issues
      const colorRegex = new RegExp(ESC + "\\[(\\d+)m");
      const colorMatch1 = result1.match(colorRegex);
      const colorMatch2 = result2.match(colorRegex);

      expect(colorMatch1).not.toBeNull();
      expect(colorMatch2).not.toBeNull();

      if (colorMatch1 && colorMatch2) {
        expect(colorMatch1[1]).toBe(colorMatch2[1]);
      }
    });

    it("should use different colors for different domains", () => {
      // Test different domains that should hash to different colors
      const testDomains = [
        "https://example.com",
        "https://google.com",
        "https://github.com",
        "https://stackoverflow.com",
        "https://reddit.com",
        "https://twitter.com",
        "https://facebook.com",
        "https://youtube.com",
      ];

      // Extract color codes - need to look for bold + color pattern
      const colors = testDomains.map((url) => {
        const result = formatUrl(url);
        // Match the pattern: bold (ESC[1m) followed by color (ESC[XXm)
        const boldColorRegex = new RegExp(ESC + "\\[1m" + ESC + "\\[(\\d+)m");
        const matches = result.match(boldColorRegex);
        if (matches) {
          return matches[1];
        }
        // Try just color code without bold
        const colorOnlyRegex = new RegExp(ESC + "\\[(\\d+)m");
        const colorOnly = result.match(colorOnlyRegex);
        return colorOnly ? colorOnly[1] : null;
      });

      // Check if we got any color codes at all
      const validColors = colors.filter((c) => c !== null);

      // At least some should be different
      const uniqueColors = new Set(validColors);
      expect(uniqueColors.size).toBeGreaterThan(1);
    });
  });

  describe("formatBrowser", () => {
    it("should format browser name with color and bold", () => {
      const result = formatBrowser("Chromium");
      expect(result).toContain("Chromium");
      expect(result).toContain(ESC + "["); // Should contain ANSI codes
    });
  });

  describe("shouldUseColors", () => {
    it("should return true when stdout is TTY and not in CI/test", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
      delete process.env.CI;
      delete process.env.NODE_ENV;

      expect(shouldUseColors()).toBe(true);
    });

    it("should return false when not TTY", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
      });

      expect(shouldUseColors()).toBe(false);
    });

    it("should return false in CI environment", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
      process.env.CI = "true";

      expect(shouldUseColors()).toBe(false);
    });

    it("should return false in test environment", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
      process.env.NODE_ENV = "test";

      expect(shouldUseColors()).toBe(false);
    });
  });

  describe("conditionalFormat", () => {
    it("should apply formatting when colors are enabled", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
      delete process.env.CI;
      delete process.env.NODE_ENV;

      const formatter = (text: string): string => `formatted-${text}`;
      const result = conditionalFormat("test", formatter);
      expect(result).toBe("formatted-test");
    });

    it("should skip formatting when colors are disabled", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
      });

      const formatter = (text: string): string => `formatted-${text}`;
      const result = conditionalFormat("test", formatter);
      expect(result).toBe("test");
    });
  });

  describe("createUrlPrefix", () => {
    it("should create prefix with domain only for root URLs", () => {
      const result = createUrlPrefix("https://example.com/");
      expect(result).toContain("[example.com]");
    });

    it("should create prefix with domain and path for nested URLs", () => {
      const result = createUrlPrefix("https://example.com/nested/path");
      expect(result).toContain("[example.com/nested/path]");
    });

    it("should handle URLs without protocol", () => {
      const result = createUrlPrefix("example.com/path");
      expect(result).toContain("[example.com/path]");
    });

    it("should handle invalid URLs gracefully", () => {
      const result = createUrlPrefix("invalid-url");
      expect(result).toContain("[invalid-url]");
    });

    it("should use consistent colors for the same URL path", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
      delete process.env.CI;
      delete process.env.NODE_ENV;

      const result1 = createUrlPrefix("https://example.com/page");
      const result2 = createUrlPrefix("https://example.com/page");
      const result3 = createUrlPrefix("https://example.com/page");

      // Extract color codes from results
      const colorRegex = new RegExp(ESC + "\\[(\\d+)m");
      const colorMatch1 = result1.match(colorRegex);
      const colorMatch2 = result2.match(colorRegex);
      const colorMatch3 = result3.match(colorRegex);

      expect(colorMatch1).not.toBeNull();
      expect(colorMatch2).not.toBeNull();
      expect(colorMatch3).not.toBeNull();

      // All identical URLs should have same color
      if (colorMatch1 && colorMatch2 && colorMatch3) {
        expect(colorMatch1[1]).toBe(colorMatch2[1]);
        expect(colorMatch2[1]).toBe(colorMatch3[1]);
      }
    });

    it("should use different colors for different paths", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
      delete process.env.CI;
      delete process.env.NODE_ENV;

      // Use different paths from same domain to ensure we get color variety
      const urls = [
        "https://example.com",
        "https://example.com/blog",
        "https://example.com/about",
        "https://example.com/contact",
        "https://example.com/products",
        "https://example.com/services",
        "https://example.com/team",
        "https://example.com/careers",
      ];

      const colors = urls.map((url) => {
        const result = createUrlPrefix(url);
        // Match the pattern: bold (ESC[1m) followed by color (ESC[XXm)
        const boldColorRegex = new RegExp(ESC + "\\[1m" + ESC + "\\[(\\d+)m");
        const matches = result.match(boldColorRegex);
        if (matches) {
          return matches[1];
        }
        // Try just color code without bold
        const colorOnlyRegex = new RegExp(ESC + "\\[(\\d+)m");
        const colorOnly = result.match(colorOnlyRegex);
        return colorOnly ? colorOnly[1] : null;
      });

      // Check if we got any color codes at all
      const validColors = colors.filter((c) => c !== null);

      // Different paths should have different colors
      const uniqueColors = new Set(validColors);
      expect(uniqueColors.size).toBeGreaterThan(3);
    });
  });

  describe("prefixWithUrl", () => {
    it("should prefix message with URL", () => {
      const result = prefixWithUrl("https://example.com/", "Loading page");
      expect(result).toContain("[example.com] Loading page");
    });

    it("should work with nested URLs", () => {
      const result = prefixWithUrl("https://example.com/nested", "Processing");
      expect(result).toContain("[example.com/nested] Processing");
    });
  });
});
