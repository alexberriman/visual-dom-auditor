import { describe, it, expect, vi, beforeEach } from "vitest";
import { preparePage, closeBrowser } from "./browser";
import type { Response } from "playwright-core";
import { chromium } from "playwright-core";

// Mock the playwright-core module
vi.mock("playwright-core", () => {
  const mockResponse = {
    ok: vi.fn().mockReturnValue(true),
    status: vi.fn().mockReturnValue(200),
  };
  
  const mockPage = {
    goto: vi.fn().mockResolvedValue(mockResponse),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn()
      .mockResolvedValueOnce(2000) // document.body.scrollHeight
      .mockResolvedValueOnce(800)  // window.innerHeight
      .mockResolvedValue(undefined), // window.scrollTo
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
  };
  
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  
  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
  };
});

describe("browser", () => {
  const mockConfig = {
    url: "https://example.com",
    viewport: {
      width: 1920,
      height: 1080,
    },
    format: "json" as const,
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe("preparePage", () => {
    it("should successfully prepare a page", async () => {
      const result = await preparePage(mockConfig);
      
      expect(result.ok).toBe(true);
      expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
      
      if (result.ok) {
        const { browser, page } = result.val;
        expect(browser).toBeDefined();
        expect(page).toBeDefined();
        
        expect(page.goto).toHaveBeenCalledWith(mockConfig.url, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });
        
        expect(page.setViewportSize).toHaveBeenCalledWith({
          width: mockConfig.viewport.width,
          height: mockConfig.viewport.height,
        });
        
        expect(page.evaluate).toHaveBeenCalled();
        expect(page.waitForTimeout).toHaveBeenCalled();
        expect(page.waitForLoadState).toHaveBeenCalledWith("networkidle");
      }
    });
    
    it("should return an error when browser launch fails", async () => {
      const error = new Error("Browser launch failed");
      vi.mocked(chromium.launch).mockRejectedValueOnce(error);
      
      const result = await preparePage(mockConfig);
      
      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toBe("Failed to launch browser");
        expect(result.val.cause).toBe(error);
      }
    });
    
    it("should return an error when page navigation fails", async () => {
      const mockBrowser = await chromium.launch();
      const mockPage = await mockBrowser.newPage();
      
      const mockFailedResponse = {
        ok: vi.fn().mockReturnValue(false),
        status: vi.fn().mockReturnValue(404),
      } as unknown as Response;
      
      vi.mocked(mockPage.goto).mockResolvedValueOnce(mockFailedResponse);
      
      const result = await preparePage(mockConfig);
      
      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.message).toContain("Failed to load URL");
        expect(result.val.message).toContain("404");
      }
      
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
  
  describe("closeBrowser", () => {
    it("should close the browser", async () => {
      const mockBrowser = await chromium.launch();
      
      await closeBrowser(mockBrowser);
      
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});