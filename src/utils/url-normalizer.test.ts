import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  isInternalUrl,
  isNavigationalUrl,
  extractDomain,
  normalizeUrls,
} from "./url-normalizer";

describe("normalizeUrl", () => {
  it("should normalize basic URLs", () => {
    const result = normalizeUrl("https://example.com/path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/path");
    }
  });

  it("should remove trailing slashes", () => {
    const result = normalizeUrl("https://example.com/path/");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/path");
    }
  });

  it("should preserve root trailing slash", () => {
    const result = normalizeUrl("https://example.com/");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/");
    }
  });

  it("should convert HTTP to HTTPS", () => {
    const result = normalizeUrl("http://example.com/path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/path");
    }
  });

  it("should preserve localhost HTTP", () => {
    const result = normalizeUrl("http://localhost:3000/path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("http://localhost:3000/path");
    }
  });

  it("should remove tracking parameters", () => {
    const result = normalizeUrl("https://example.com/path?utm_source=google&fbclid=123&id=456");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/path?id=456");
    }
  });

  it("should sort query parameters", () => {
    const result = normalizeUrl("https://example.com/path?z=1&a=2&m=3");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/path?a=2&m=3&z=1");
    }
  });

  it("should remove hash by default", () => {
    const result = normalizeUrl("https://example.com/path#section");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/path");
    }
  });

  it("should preserve hash when configured", () => {
    const result = normalizeUrl("https://example.com/path#section", undefined, {
      preserveHash: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/path#section");
    }
  });

  it("should convert relative URLs to absolute", () => {
    const result = normalizeUrl("/path/to/page", "https://example.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com/path/to/page");
    }
  });

  it("should handle invalid URLs", () => {
    const result = normalizeUrl("not-a-url");
    expect(result.ok).toBe(false);
  });
});

describe("isInternalUrl", () => {
  it("should identify same domain as internal", () => {
    const result = isInternalUrl("https://example.com/path", "https://example.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(true);
    }
  });

  it("should identify different domain as external", () => {
    const result = isInternalUrl("https://other.com/path", "https://example.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(false);
    }
  });

  it("should identify subdomain as internal when enabled", () => {
    const result = isInternalUrl("https://sub.example.com/path", "https://example.com", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(true);
    }
  });

  it("should identify subdomain as external when disabled", () => {
    const result = isInternalUrl("https://sub.example.com/path", "https://example.com", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(false);
    }
  });

  it("should handle different protocols", () => {
    const result = isInternalUrl("http://example.com/path", "https://example.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(false);
    }
  });
});

describe("isNavigationalUrl", () => {
  it("should identify regular pages as navigational", () => {
    const result = isNavigationalUrl("https://example.com/about");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(true);
    }
  });

  it("should identify images as non-navigational", () => {
    const result = isNavigationalUrl("https://example.com/image.jpg");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(false);
    }
  });

  it("should identify CSS files as non-navigational", () => {
    const result = isNavigationalUrl("https://example.com/styles.css");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(false);
    }
  });

  it("should identify API endpoints as non-navigational", () => {
    const result = isNavigationalUrl("https://example.com/api/users");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(false);
    }
  });

  it("should identify static assets as non-navigational", () => {
    const result = isNavigationalUrl("https://example.com/static/bundle.js");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(false);
    }
  });
});

describe("extractDomain", () => {
  it("should extract domain from URL", () => {
    const result = extractDomain("https://example.com/path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com");
    }
  });

  it("should normalize domain case", () => {
    const result = extractDomain("https://EXAMPLE.COM/path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("https://example.com");
    }
  });

  it("should preserve protocol and port", () => {
    const result = extractDomain("http://localhost:3000/path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe("http://localhost");
    }
  });
});

describe("normalizeUrls", () => {
  it("should normalize multiple URLs and deduplicate", () => {
    const urls = [
      "https://example.com/path/",
      "https://example.com/path",
      "https://example.com/other",
    ];
    const result = normalizeUrls(urls);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toHaveLength(2);
      expect(result.val).toContain("https://example.com/path");
      expect(result.val).toContain("https://example.com/other");
    }
  });

  it("should handle some invalid URLs gracefully", () => {
    const urls = ["https://example.com/valid", "not-a-url"];
    const result = normalizeUrls(urls);
    expect(result.ok).toBe(false);
  });
});
