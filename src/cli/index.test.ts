import { describe, it, expect } from "vitest";
import { parseCli } from "./index";

// Mock commander by intercepting process.argv
const mockProcessArgv = (args: string[]): (() => void) => {
  const originalArgv = process.argv;
  process.argv = ["node", "script", ...args];
  return () => {
    process.argv = originalArgv;
  };
};

describe("parseCli", () => {
  describe("single URL parsing", () => {
    it("parses single URL correctly", () => {
      const restore = mockProcessArgv(["--url", "https://example.com"]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.urls).toEqual(["https://example.com"]);
        expect(result.val.exitEarly).toBe(false);
      }
    });

    it("parses single URL with exit-early flag", () => {
      const restore = mockProcessArgv(["--url", "https://example.com", "--exit-early"]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.urls).toEqual(["https://example.com"]);
        expect(result.val.exitEarly).toBe(true);
      }
    });
  });

  describe("multiple URL parsing", () => {
    it("parses multiple URLs correctly", () => {
      const restore = mockProcessArgv([
        "--urls",
        "https://example.com",
        "https://test.com",
        "https://demo.com",
      ]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.urls).toEqual([
          "https://example.com",
          "https://test.com",
          "https://demo.com",
        ]);
        expect(result.val.exitEarly).toBe(false);
      }
    });

    it("parses multiple URLs with exit-early flag", () => {
      const restore = mockProcessArgv([
        "--urls",
        "https://example.com",
        "https://test.com",
        "--exit-early",
      ]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.urls).toEqual(["https://example.com", "https://test.com"]);
        expect(result.val.exitEarly).toBe(true);
      }
    });
  });

  describe("error cases", () => {
    it("returns error when neither --url nor --urls provided", () => {
      const restore = mockProcessArgv([]);

      const result = parseCli();

      restore();

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toBe("Either --url or --urls is required");
      }
    });

    it("returns error when both --url and --urls provided", () => {
      const restore = mockProcessArgv([
        "--url",
        "https://example.com",
        "--urls",
        "https://test.com",
      ]);

      const result = parseCli();

      restore();

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toBe(
          "Cannot specify both --url and --urls. Use --url for single URL or --urls for multiple URLs"
        );
      }
    });

    it("returns error for invalid URL in single URL mode", () => {
      const restore = mockProcessArgv(["--url", "invalid-url"]);

      const result = parseCli();

      restore();

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toBe("Invalid URL: invalid-url");
      }
    });

    it("returns error for invalid URL in multiple URLs mode", () => {
      const restore = mockProcessArgv(["--urls", "https://example.com", "invalid-url"]);

      const result = parseCli();

      restore();

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toBe("Invalid URL: invalid-url");
      }
    });
  });

  describe("viewport parsing", () => {
    it("uses default desktop viewport when no viewport specified", () => {
      const restore = mockProcessArgv(["--url", "https://example.com"]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.viewport).toEqual({ width: 1920, height: 1080 });
      }
    });

    it("parses preset viewport correctly", () => {
      const restore = mockProcessArgv(["--url", "https://example.com", "--viewport", "mobile"]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.viewport).toEqual({ width: 375, height: 667 });
      }
    });

    it("parses custom viewport correctly", () => {
      const restore = mockProcessArgv(["--url", "https://example.com", "--viewport", "1024x768"]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.viewport).toEqual({ width: 1024, height: 768 });
      }
    });
  });

  describe("detector parsing", () => {
    it("uses undefined detectors when no detectors specified", () => {
      const restore = mockProcessArgv(["--url", "https://example.com"]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.detectors).toBeUndefined();
      }
    });

    it("parses comma-separated detectors correctly", () => {
      const restore = mockProcessArgv([
        "--url",
        "https://example.com",
        "--detectors",
        "console-error,overlap,padding",
      ]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.detectors).toEqual(["console-error", "overlap", "padding"]);
      }
    });

    it("parses space-separated detectors correctly", () => {
      const restore = mockProcessArgv([
        "--url",
        "https://example.com",
        "--detectors",
        "console-error overlap padding",
      ]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.detectors).toEqual(["console-error", "overlap", "padding"]);
      }
    });

    it("parses mixed comma and space-separated detectors correctly", () => {
      const restore = mockProcessArgv([
        "--url",
        "https://example.com",
        "--detectors",
        "console-error, overlap spacing",
      ]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.detectors).toEqual(["console-error", "overlap", "spacing"]);
      }
    });

    it("handles disabled detectors correctly", () => {
      const restore = mockProcessArgv([
        "--url",
        "https://example.com",
        "--detectors",
        "centering,overlap",
      ]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.detectors).toEqual(["centering", "overlap"]);
      }
    });

    it("returns error for unknown detector", () => {
      const restore = mockProcessArgv([
        "--url",
        "https://example.com",
        "--detectors",
        "unknown-detector,overlap",
      ]);

      const result = parseCli();

      restore();

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain("Unknown detector: unknown-detector");
        expect(result.val.message).toContain("Available detectors:");
      }
    });

    it("handles empty detector string correctly", () => {
      const restore = mockProcessArgv(["--url", "https://example.com", "--detectors", ""]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.detectors).toBeUndefined();
      }
    });

    it("filters out empty detector names from input", () => {
      const restore = mockProcessArgv([
        "--url",
        "https://example.com",
        "--detectors",
        "overlap, , spacing, ,",
      ]);

      const result = parseCli();

      restore();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.detectors).toEqual(["overlap", "spacing"]);
      }
    });
  });
});
