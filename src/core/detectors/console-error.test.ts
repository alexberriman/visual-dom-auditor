import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleErrorDetector } from "./console-error";
import type { Page } from "playwright-core";

// Mock Playwright Page
const createMockPage = (): Page & {
  _triggerEvent: (_event: string, ..._args: unknown[]) => void;
} => {
  const eventListeners: Record<string, Array<(..._args: unknown[]) => void>> = {};

  return {
    on: vi.fn((_event: string, handler: (..._args: unknown[]) => void) => {
      if (!eventListeners[_event]) {
        eventListeners[_event] = [];
      }
      eventListeners[_event].push(handler);
    }),
    removeAllListeners: vi.fn((_event?: string) => {
      if (_event) {
        eventListeners[_event] = [];
      } else {
        Object.keys(eventListeners).forEach((key) => {
          eventListeners[key] = [];
        });
      }
    }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    // Helper to trigger events for testing
    _triggerEvent: (_event: string, ..._args: unknown[]) => {
      if (eventListeners[_event]) {
        eventListeners[_event].forEach((handler) => handler(..._args));
      }
    },
  } as unknown as Page & { _triggerEvent: (_event: string, ..._args: unknown[]) => void };
};

// Mock console message
const createMockConsoleMessage = (
  type: "error" | "warning" | "info" | "log",
  text: string,
  url?: string,
  lineNumber?: number,
  columnNumber?: number
): {
  type: () => "error" | "warning" | "info" | "log";
  text: () => string;
  location: () => { url: string; lineNumber: number; columnNumber: number };
} => ({
  type: () => type,
  text: () => text,
  location: () => ({
    url: url || "",
    lineNumber: lineNumber || 0,
    columnNumber: columnNumber || 0,
  }),
});

// Mock page error
const createMockPageError = (
  message: string,
  stack?: string
): {
  message: string;
  stack?: string;
} => ({
  message,
  stack,
});

describe("ConsoleErrorDetector", () => {
  let detector: ConsoleErrorDetector;
  let mockPage: Page & { _triggerEvent: (_event: string, ..._args: unknown[]) => void };

  beforeEach(() => {
    detector = new ConsoleErrorDetector();
    mockPage = createMockPage();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("detect", () => {
    it("should return empty array when no console messages", async () => {
      const result = await detector.detect(mockPage);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toEqual([]);
      }
    });

    it("should detect console errors", async () => {
      const detectPromise = detector.detect(mockPage);

      // Trigger a console error
      const errorMessage = createMockConsoleMessage(
        "error",
        "Uncaught TypeError: Cannot read property 'foo' of undefined",
        "https://example.com/app.js",
        42,
        15
      );

      mockPage._triggerEvent("console", errorMessage);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toHaveLength(1);
        const issue = result.val[0];
        expect(issue.type).toBe("console-error");
        expect(issue.level).toBe("error");
        expect(issue.severity).toBe("critical");
        expect(issue.message).toContain("Console Error:");
        expect(issue.message).toContain("TypeError");
        expect(issue.source.url).toBe("https://example.com/app.js");
        expect(issue.source.line).toBe(42);
        expect(issue.source.column).toBe(15);
      }
    });

    it("should detect console warnings when enabled", async () => {
      detector = new ConsoleErrorDetector({ includeWarnings: true });

      const detectPromise = detector.detect(mockPage);

      // Trigger a console warning
      const warningMessage = createMockConsoleMessage(
        "warning",
        "Deprecated API usage detected",
        "https://example.com/app.js",
        100
      );

      mockPage._triggerEvent("console", warningMessage);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toHaveLength(1);
        const issue = result.val[0];
        expect(issue.type).toBe("console-error");
        expect(issue.level).toBe("warning");
        expect(issue.severity).toBe("major");
        expect(issue.message).toContain("Console Warning:");
      }
    });

    it("should ignore warnings when disabled", async () => {
      detector = new ConsoleErrorDetector({ includeWarnings: false });

      const detectPromise = detector.detect(mockPage);

      // Trigger a console warning
      const warningMessage = createMockConsoleMessage("warning", "Some warning message");

      mockPage._triggerEvent("console", warningMessage);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toHaveLength(0);
      }
    });

    it("should detect page errors", async () => {
      const detectPromise = detector.detect(mockPage);

      // Trigger a page error
      const pageError = createMockPageError(
        "ReferenceError: undefined variable",
        "Error stack trace here"
      );

      mockPage._triggerEvent("pageerror", pageError);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toHaveLength(1);
        const issue = result.val[0];
        expect(issue.type).toBe("console-error");
        expect(issue.level).toBe("error");
        expect(issue.severity).toBe("critical");
        expect(issue.stackTrace).toBe("Error stack trace here");
      }
    });

    it("should ignore messages matching ignore patterns", async () => {
      detector = new ConsoleErrorDetector({
        ignorePatterns: ["favicon.ico", "test-pattern"],
      });

      const detectPromise = detector.detect(mockPage);

      // Trigger console errors that should be ignored
      const ignoredError1 = createMockConsoleMessage(
        "error",
        "Failed to load resource: favicon.ico"
      );
      const ignoredError2 = createMockConsoleMessage("error", "Some test-pattern error");
      const validError = createMockConsoleMessage("error", "Real error that should not be ignored");

      mockPage._triggerEvent("console", ignoredError1);
      mockPage._triggerEvent("console", ignoredError2);
      mockPage._triggerEvent("console", validError);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toHaveLength(1);
        expect(result.val[0].message).toContain("Real error");
      }
    });

    it("should respect maxMessages limit", async () => {
      detector = new ConsoleErrorDetector({ maxMessages: 2 });

      const detectPromise = detector.detect(mockPage);

      // Trigger more errors than the limit
      for (let i = 0; i < 5; i++) {
        const errorMessage = createMockConsoleMessage("error", `Error message ${i}`);
        mockPage._triggerEvent("console", errorMessage);
      }

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toHaveLength(2);
      }
    });

    it("should sort issues by severity", async () => {
      const detectPromise = detector.detect(mockPage);

      // Trigger errors with different severities
      const minorWarning = createMockConsoleMessage("warning", "Minor warning message");
      const criticalError = createMockConsoleMessage("error", "Uncaught TypeError: critical error");
      const majorError = createMockConsoleMessage("error", "Failed to load resource: 404");
      const majorWarning = createMockConsoleMessage("warning", "Deprecated security feature");

      mockPage._triggerEvent("console", minorWarning);
      mockPage._triggerEvent("console", criticalError);
      mockPage._triggerEvent("console", majorError);
      mockPage._triggerEvent("console", majorWarning);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toHaveLength(4);
        expect(result.val[0].severity).toBe("critical");
        expect(result.val[1].severity).toBe("major");
        expect(result.val[2].severity).toBe("major");
        expect(result.val[3].severity).toBe("minor");
      }
    });

    it("should ignore info and log messages", async () => {
      const detectPromise = detector.detect(mockPage);

      // Trigger non-error messages
      const infoMessage = createMockConsoleMessage("info", "Info message");
      const logMessage = createMockConsoleMessage("log", "Log message");
      const errorMessage = createMockConsoleMessage("error", "Error message");

      mockPage._triggerEvent("console", infoMessage);
      mockPage._triggerEvent("console", logMessage);
      mockPage._triggerEvent("console", errorMessage);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toHaveLength(1);
        expect(result.val[0].level).toBe("error");
      }
    });
  });

  describe("severity determination", () => {
    it("should assign critical severity to syntax errors", async () => {
      const detectPromise = detector.detect(mockPage);

      const syntaxError = createMockConsoleMessage("error", "SyntaxError: Unexpected token");

      mockPage._triggerEvent("console", syntaxError);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val[0].severity).toBe("critical");
      }
    });

    it("should assign major severity to network errors", async () => {
      const detectPromise = detector.detect(mockPage);

      const networkError = createMockConsoleMessage(
        "error",
        "Failed to load resource: net::ERR_CONNECTION_REFUSED"
      );

      mockPage._triggerEvent("console", networkError);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val[0].severity).toBe("major");
      }
    });

    it("should assign major severity to security warnings", async () => {
      const detectPromise = detector.detect(mockPage);

      const securityWarning = createMockConsoleMessage("warning", "Unsafe inline script detected");

      mockPage._triggerEvent("console", securityWarning);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val[0].severity).toBe("major");
      }
    });

    it("should assign minor severity to general warnings", async () => {
      const detectPromise = detector.detect(mockPage);

      const generalWarning = createMockConsoleMessage("warning", "General warning message");

      mockPage._triggerEvent("console", generalWarning);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val[0].severity).toBe("minor");
      }
    });
  });

  describe("message formatting", () => {
    it("should format error messages with location", async () => {
      const detectPromise = detector.detect(mockPage);

      const errorWithLocation = createMockConsoleMessage(
        "error",
        "Some error occurred",
        "https://example.com/script.js",
        25,
        10
      );

      mockPage._triggerEvent("console", errorWithLocation);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val[0].message).toBe(
          "Console Error: Some error occurred (https://example.com/script.js:25:10)"
        );
      }
    });

    it("should format warning messages", async () => {
      const detectPromise = detector.detect(mockPage);

      const warning = createMockConsoleMessage("warning", "Some warning occurred");

      mockPage._triggerEvent("console", warning);

      const result = await detectPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val[0].message).toBe("Console Warning: Some warning occurred");
      }
    });
  });
});
