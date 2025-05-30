import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { main } from "./index";
import { Ok, Err } from "./types/ts-results";
import type { Browser, Page } from "playwright-core";

// Mock the CLI module
vi.mock("./cli", () => ({
  parseCli: vi.fn(),
}));

// Mock browser and analyzer modules
vi.mock("./core/browser", () => ({
  preparePage: vi.fn(),
  closeBrowser: vi.fn(),
}));

vi.mock("./core/analyzer", () => ({
  validateResult: vi.fn(),
}));

// Mock node:fs promises
vi.mock("node:fs", () => ({
  promises: {
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Mock playwright-core
vi.mock("playwright-core", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

// Mock detectors
vi.mock("./core/detectors/console-error", () => ({
  ConsoleErrorDetector: vi.fn().mockImplementation(() => ({
    startListeningEarly: vi.fn(),
    collectErrors: vi.fn().mockResolvedValue({
      ok: true,
      val: [],
    }),
  })),
}));

vi.mock("./core/detectors", () => ({
  detectors: {},
  disabledDetectors: {},
}));

// Import the mocked modules
import { parseCli } from "./cli";
import { preparePage, closeBrowser } from "./core/browser";
import { validateResult } from "./core/analyzer";

describe("main", () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();

    // Set default mock implementations
    vi.mocked(closeBrowser).mockResolvedValue();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clear all mocks
    vi.clearAllMocks();
  });

  it("should return 0 when CLI parsing succeeds", async () => {
    const mockConfig = {
      urls: ["https://example.com"],
      viewport: { width: 1920, height: 1080 },
      format: "json" as const,
      exitEarly: false,
      detectors: undefined,
    };

    // Mock successful CLI parsing
    vi.mocked(parseCli).mockReturnValue(Ok(mockConfig));

    // Mock successful browser preparation
    vi.mocked(preparePage).mockResolvedValue(Ok({ browser: {} as Browser, page: {} as Page }));

    // Since we no longer use analyzePage in the main function, we don't need to mock it

    // Mock successful result validation
    vi.mocked(validateResult).mockReturnValue(true);

    const exitCode = await main();

    expect(exitCode).toBe(0);
  });

  it("should return 1 when CLI parsing fails", async () => {
    // Mock failed CLI parsing
    vi.mocked(parseCli).mockReturnValue(Err({ message: "Invalid URL" }));

    const exitCode = await main();

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith("Error: Invalid URL");
  });
});
