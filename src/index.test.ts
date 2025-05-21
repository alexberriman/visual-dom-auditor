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
  analyzePage: vi.fn(),
  validateResult: vi.fn(),
}));

// Import the mocked modules
import { parseCli } from "./cli";
import { preparePage, closeBrowser } from "./core/browser";
import { analyzePage, validateResult } from "./core/analyzer";

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
      url: "https://example.com",
      viewport: { width: 1920, height: 1080 },
      format: "json" as const,
    };

    // Mock successful CLI parsing
    vi.mocked(parseCli).mockReturnValue(Ok(mockConfig));

    // Mock successful browser preparation
    vi.mocked(preparePage).mockResolvedValue(Ok({ browser: {} as Browser, page: {} as Page }));

    // Mock successful page analysis
    vi.mocked(analyzePage).mockResolvedValue(
      Ok({
        url: mockConfig.url,
        timestamp: "2023-01-01T00:00:00.000Z",
        viewport: mockConfig.viewport,
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
      })
    );

    // Mock successful result validation
    vi.mocked(validateResult).mockReturnValue(true);

    const exitCode = await main();

    expect(exitCode).toBe(0);
    expect(console.log).toHaveBeenCalledWith("Starting analysis of https://example.com");
    expect(console.log).toHaveBeenCalledWith("Using viewport: 1920x1080");
    expect(console.log).toHaveBeenCalledWith("Analysis complete!");
  });

  it("should return 1 when CLI parsing fails", async () => {
    // Mock failed CLI parsing
    vi.mocked(parseCli).mockReturnValue(Err({ message: "Invalid URL" }));

    const exitCode = await main();

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith("Error: Invalid URL");
  });
});
