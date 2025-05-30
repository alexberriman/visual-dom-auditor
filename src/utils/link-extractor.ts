import type { Page } from "playwright-core";
import { Ok, Err, type Result } from "../types/ts-results";
import { normalizeUrl, isInternalUrl, isNavigationalUrl } from "./url-normalizer";

/**
 * Error type for link extraction operations
 */
type LinkExtractionError = {
  message: string;
  cause?: unknown;
};

/**
 * Configuration for link extraction behavior
 */
type LinkExtractionConfig = {
  readonly includeSubdomains: boolean;
  readonly followNavigationalOnly: boolean;
  readonly excludePatterns: readonly string[];
  readonly includePatterns: readonly string[];
  readonly maxLinksPerPage: number;
};

/**
 * Default configuration for link extraction
 */
const DEFAULT_CONFIG: LinkExtractionConfig = {
  includeSubdomains: true,
  followNavigationalOnly: true,
  excludePatterns: [
    "/login",
    "/logout",
    "/signin",
    "/signup",
    "/register",
    "/admin",
    "/dashboard",
    "/account",
    "/profile",
    "/download",
    "/print",
    "/pdf",
    "/export",
    "/search",
    "/filter",
    "/sort",
  ],
  includePatterns: [],
  maxLinksPerPage: 1000,
};

/**
 * Extracted link information
 */
type ExtractedLink = {
  readonly url: string;
  readonly normalizedUrl: string;
  readonly text: string;
  readonly title?: string;
};

/**
 * Raw link data from page
 */
type RawLink = {
  href: string;
  text: string;
  title?: string;
};

/**
 * Check if a URL should be included based on patterns
 */
const shouldIncludeUrl = (normalizedUrl: string, config: LinkExtractionConfig): boolean => {
  // Apply exclude patterns
  const isExcluded = config.excludePatterns.some((pattern) =>
    normalizedUrl.toLowerCase().includes(pattern.toLowerCase())
  );

  if (isExcluded) {
    return false;
  }

  // Apply include patterns (if any specified)
  if (config.includePatterns.length > 0) {
    return config.includePatterns.some((pattern) =>
      normalizedUrl.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  return true;
};

/**
 * Process a single link and determine if it should be extracted
 */
const processLink = (
  link: RawLink,
  baseUrl: string,
  config: LinkExtractionConfig,
  seenUrls: Set<string>
): ExtractedLink | null => {
  // Normalize the URL
  const normalizeResult = normalizeUrl(link.href, baseUrl);
  if (normalizeResult.err) {
    return null; // Skip invalid URLs
  }
  const normalizedUrl = normalizeResult.val;

  // Skip if we've already seen this normalized URL
  if (seenUrls.has(normalizedUrl)) {
    return null;
  }
  seenUrls.add(normalizedUrl);

  // Check if it's an internal URL
  const internalResult = isInternalUrl(normalizedUrl, baseUrl, config.includeSubdomains);
  if (internalResult.err || !internalResult.val) {
    return null; // Skip external URLs
  }

  // Check if it's navigational (if configured)
  if (config.followNavigationalOnly) {
    const navResult = isNavigationalUrl(normalizedUrl);
    if (navResult.err || !navResult.val) {
      return null; // Skip non-navigational URLs
    }
  }

  // Check include/exclude patterns
  if (!shouldIncludeUrl(normalizedUrl, config)) {
    return null;
  }

  return {
    url: link.href,
    normalizedUrl,
    text: link.text,
    title: link.title,
  };
};

/**
 * Extract all internal navigational links from a page
 */
export const extractLinks = async (
  page: Page,
  baseUrl: string,
  config: Partial<LinkExtractionConfig> = {}
): Promise<Result<ExtractedLink[], LinkExtractionError>> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Extract all links from the page
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href], area[href]"));

      return anchors
        .map((anchor) => ({
          href: anchor.getAttribute("href") || "",
          text: (anchor.textContent || "").trim(),
          title: anchor.getAttribute("title") || undefined,
        }))
        .filter((link) => link.href && link.href !== "#" && !link.href.startsWith("#"));
    });

    if (links.length > finalConfig.maxLinksPerPage) {
      return Err({
        message: `Too many links found on page (${links.length} > ${finalConfig.maxLinksPerPage})`,
      });
    }

    const extractedLinks: ExtractedLink[] = [];
    const seenUrls = new Set<string>();

    for (const link of links) {
      try {
        const extractedLink = processLink(link, baseUrl, finalConfig, seenUrls);
        if (extractedLink) {
          extractedLinks.push(extractedLink);
        }
      } catch {
        // Skip this link and continue with others
        continue;
      }
    }

    return Ok(extractedLinks);
  } catch (error) {
    return Err({
      message: "Failed to extract links from page",
      cause: error,
    });
  }
};

/**
 * Extract unique URLs from a page
 */
export const extractUniqueUrls = async (
  page: Page,
  baseUrl: string,
  config: Partial<LinkExtractionConfig> = {}
): Promise<Result<string[], LinkExtractionError>> => {
  const linksResult = await extractLinks(page, baseUrl, config);

  if (linksResult.err) {
    return linksResult;
  }

  const uniqueUrls = Array.from(new Set(linksResult.val.map((link) => link.normalizedUrl)));

  return Ok(uniqueUrls);
};

/**
 * Process link for metadata collection
 */
const processLinkForMetadata = (
  link: RawLink,
  baseUrl: string,
  config: LinkExtractionConfig,
  seenUrls: Set<string>,
  counts: { internal: number; navigational: number }
): ExtractedLink | null => {
  // Normalize the URL
  const normalizeResult = normalizeUrl(link.href, baseUrl);
  if (normalizeResult.err) {
    return null;
  }
  const normalizedUrl = normalizeResult.val;

  // Check if it's internal
  const internalResult = isInternalUrl(normalizedUrl, baseUrl, config.includeSubdomains);
  if (internalResult.err || !internalResult.val) {
    return null;
  }

  counts.internal++;

  // Check if it's navigational
  const navResult = isNavigationalUrl(normalizedUrl);
  if (navResult.err || !navResult.val) {
    return null;
  }

  counts.navigational++;

  // Skip if we've already seen this normalized URL
  if (seenUrls.has(normalizedUrl)) {
    return null;
  }
  seenUrls.add(normalizedUrl);

  // Check include/exclude patterns
  if (!shouldIncludeUrl(normalizedUrl, config)) {
    return null;
  }

  return {
    url: link.href,
    normalizedUrl,
    text: link.text,
    title: link.title,
  };
};

/**
 * Extract links with metadata for debugging/analysis
 */
export const extractLinksWithMetadata = async (
  page: Page,
  baseUrl: string,
  config: Partial<LinkExtractionConfig> = {}
): Promise<
  Result<
    {
      totalLinksFound: number;
      internalLinks: number;
      navigationalLinks: number;
      extractedLinks: ExtractedLink[];
    },
    LinkExtractionError
  >
> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Extract all links from the page
    const allLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href], area[href]"));

      return anchors
        .map((anchor) => ({
          href: anchor.getAttribute("href") || "",
          text: (anchor.textContent || "").trim(),
          title: anchor.getAttribute("title") || undefined,
        }))
        .filter((link) => link.href && link.href !== "#" && !link.href.startsWith("#"));
    });

    const counts = { internal: 0, navigational: 0 };
    const extractedLinks: ExtractedLink[] = [];
    const seenUrls = new Set<string>();

    for (const link of allLinks) {
      try {
        const extractedLink = processLinkForMetadata(link, baseUrl, finalConfig, seenUrls, counts);

        if (extractedLink) {
          extractedLinks.push(extractedLink);
        }
      } catch {
        continue;
      }
    }

    return Ok({
      totalLinksFound: allLinks.length,
      internalLinks: counts.internal,
      navigationalLinks: counts.navigational,
      extractedLinks,
    });
  } catch (error) {
    return Err({
      message: "Failed to extract links with metadata from page",
      cause: error,
    });
  }
};
