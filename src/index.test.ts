import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { main } from "./index";
import { Ok, Err } from "ts-results";

// Mock the CLI module
vi.mock("./cli", () => ({
  parseCli: vi.fn(),
}));

// Import the mocked module
import { parseCli } from "./cli";

describe("main", () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clear all mocks
    vi.clearAllMocks();
  });

  it("should return 0 when CLI parsing succeeds", async () => {
    // Mock successful CLI parsing
    vi.mocked(parseCli).mockReturnValue(
      Ok({
        url: "https://example.com",
        viewport: { width: 1920, height: 1080 },
        format: "json",
      })
    );

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
