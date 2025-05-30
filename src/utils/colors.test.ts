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
      expect(result).toContain("\x1b["); // Should contain ANSI codes
    });

    it("should handle URLs without protocol", () => {
      const result = formatUrl("example.com");
      expect(result).toContain("[example.com]");
    });

    it("should handle invalid URLs gracefully", () => {
      const result = formatUrl("not-a-url");
      expect(result).toContain("[not-a-url]");
    });
  });

  describe("formatBrowser", () => {
    it("should format browser name with color and bold", () => {
      const result = formatBrowser("Chromium");
      expect(result).toContain("Chromium");
      expect(result).toContain("\x1b["); // Should contain ANSI codes
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
