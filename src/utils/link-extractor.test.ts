import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { chromium, type Browser, type Page } from "playwright-core";
import { extractLinks, extractUniqueUrls, extractLinksWithMetadata } from "./link-extractor";

describe("link-extractor", () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterEach(async () => {
    await browser.close();
  });

  const createTestPage = async (html: string): Promise<void> => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>${html}</body>
      </html>
    `);
  };

  describe("extractLinks", () => {
    it("should extract internal links", async () => {
      await createTestPage(`
        <a href="/about">About</a>
        <a href="https://example.com/contact">Contact</a>
        <a href="https://external.com/page">External</a>
      `);

      const result = await extractLinks(page, "https://example.com");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val).toHaveLength(2);
        expect(result.val[0].normalizedUrl).toBe("https://example.com/about");
        expect(result.val[1].normalizedUrl).toBe("https://example.com/contact");
      }
    });

    it("should extract link text and titles", async () => {
      await createTestPage(`
        <a href="/about" title="About Us">About Page</a>
      `);

      const result = await extractLinks(page, "https://example.com");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val[0].text).toBe("About Page");
        expect(result.val[0].title).toBe("About Us");
      }
    });

    it("should filter out non-navigational links", async () => {
      await createTestPage(`
        <a href="/page">Valid Page</a>
        <a href="/image.jpg">Image</a>
        <a href="/api/data">API</a>
        <a href="/static/bundle.js">JavaScript</a>
      `);

      const result = await extractLinks(page, "https://example.com");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val).toHaveLength(1);
        expect(result.val[0].normalizedUrl).toBe("https://example.com/page");
      }
    });

    it("should apply exclude patterns", async () => {
      await createTestPage(`
        <a href="/about">About</a>
        <a href="/login">Login</a>
        <a href="/admin/panel">Admin</a>
      `);

      const result = await extractLinks(page, "https://example.com", {
        excludePatterns: ["/login", "/admin"],
      });
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val).toHaveLength(1);
        expect(result.val[0].normalizedUrl).toBe("https://example.com/about");
      }
    });

    it("should apply include patterns when specified", async () => {
      await createTestPage(`
        <a href="/blog/post-1">Blog Post 1</a>
        <a href="/about">About</a>
        <a href="/blog/post-2">Blog Post 2</a>
      `);

      const result = await extractLinks(page, "https://example.com", {
        includePatterns: ["/blog"],
      });
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val).toHaveLength(2);
        expect(result.val.every((link) => link.normalizedUrl.includes("/blog"))).toBe(true);
      }
    });

    it("should deduplicate links", async () => {
      await createTestPage(`
        <a href="/about">About</a>
        <a href="/about/">About (trailing slash)</a>
        <a href="/about?utm_source=test">About (with tracking)</a>
      `);

      const result = await extractLinks(page, "https://example.com");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val).toHaveLength(1);
        expect(result.val[0].normalizedUrl).toBe("https://example.com/about");
      }
    });

    it("should handle subdomains based on configuration", async () => {
      await createTestPage(`
        <a href="https://sub.example.com/page">Subdomain</a>
        <a href="https://example.com/page">Main domain</a>
      `);

      const resultWithSubdomains = await extractLinks(page, "https://example.com", {
        includeSubdomains: true,
      });
      expect(resultWithSubdomains.ok).toBe(true);
      if (resultWithSubdomains.ok) {
        expect(resultWithSubdomains.val).toHaveLength(2);
      }

      const resultWithoutSubdomains = await extractLinks(page, "https://example.com", {
        includeSubdomains: false,
      });
      expect(resultWithoutSubdomains.ok).toBe(true);
      if (resultWithoutSubdomains.ok) {
        expect(resultWithoutSubdomains.val).toHaveLength(1);
        expect(resultWithoutSubdomains.val[0].normalizedUrl).toBe("https://example.com/page");
      }
    });

    it("should ignore hash-only links", async () => {
      await createTestPage(`
        <a href="#section">Section</a>
        <a href="/page">Valid Page</a>
      `);

      const result = await extractLinks(page, "https://example.com");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val).toHaveLength(1);
        expect(result.val[0].normalizedUrl).toBe("https://example.com/page");
      }
    });

    it("should handle area elements", async () => {
      await createTestPage(`
        <map name="testmap">
          <area href="/area-link" alt="Area Link">
        </map>
        <a href="/regular-link">Regular Link</a>
      `);

      const result = await extractLinks(page, "https://example.com");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val).toHaveLength(2);
        const urls = result.val.map((link) => link.normalizedUrl);
        expect(urls).toContain("https://example.com/area-link");
        expect(urls).toContain("https://example.com/regular-link");
      }
    });
  });

  describe("extractUniqueUrls", () => {
    it("should return only unique normalized URLs", async () => {
      await createTestPage(`
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/about/">About Again</a>
      `);

      const result = await extractUniqueUrls(page, "https://example.com");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val).toHaveLength(2);
        expect(result.val).toContain("https://example.com/about");
        expect(result.val).toContain("https://example.com/contact");
      }
    });
  });

  describe("extractLinksWithMetadata", () => {
    it("should provide extraction statistics", async () => {
      await createTestPage(`
        <a href="/about">About</a>
        <a href="https://external.com/page">External</a>
        <a href="/image.jpg">Image</a>
        <a href="/api/data">API</a>
      `);

      const result = await extractLinksWithMetadata(page, "https://example.com");
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.val.totalLinksFound).toBe(4);
        expect(result.val.internalLinks).toBe(3); // about, image.jpg, api/data
        expect(result.val.navigationalLinks).toBe(1); // only about
        expect(result.val.extractedLinks).toHaveLength(1);
      }
    });
  });
});
