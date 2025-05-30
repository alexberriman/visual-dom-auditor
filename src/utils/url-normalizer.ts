import { Ok, Err, type Result } from "../types/ts-results";

/**
 * Error type for URL normalization operations
 */
type UrlNormalizationError = {
  message: string;
  cause?: unknown;
};

/**
 * Configuration for URL normalization behavior
 */
type UrlNormalizationConfig = {
  readonly preserveQueryParams: readonly string[];
  readonly removeTrackingParams: boolean;
  readonly preserveHash: boolean;
  readonly forceLowercase: boolean;
};

/**
 * Default configuration for URL normalization
 */
const DEFAULT_CONFIG: UrlNormalizationConfig = {
  preserveQueryParams: ["id", "page", "search", "q", "filter", "sort", "category"],
  removeTrackingParams: true,
  preserveHash: false,
  forceLowercase: true,
};

/**
 * Common tracking parameters to remove
 */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "twclid",
  "_ga",
  "_gl",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
];

/**
 * Normalize a URL for consistent comparison and deduplication
 */
export const normalizeUrl = (
  url: string,
  baseUrl?: string,
  config: Partial<UrlNormalizationConfig> = {}
): Result<string, UrlNormalizationError> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Convert relative URLs to absolute
    const absoluteUrl = baseUrl ? new URL(url, baseUrl) : new URL(url);

    // Force HTTPS if HTTP is used (common normalization)
    if (absoluteUrl.protocol === "http:" && absoluteUrl.hostname !== "localhost") {
      absoluteUrl.protocol = "https:";
    }

    // Normalize hostname to lowercase
    if (finalConfig.forceLowercase) {
      absoluteUrl.hostname = absoluteUrl.hostname.toLowerCase();
    }

    // Handle query parameters
    if (finalConfig.removeTrackingParams || finalConfig.preserveQueryParams.length > 0) {
      const searchParams = new URLSearchParams(absoluteUrl.search);
      const filteredParams = new URLSearchParams();

      for (const [key, value] of searchParams.entries()) {
        const shouldPreserve = finalConfig.preserveQueryParams.includes(key.toLowerCase());
        const isTracking = TRACKING_PARAMS.includes(key.toLowerCase());

        if (shouldPreserve || !finalConfig.removeTrackingParams || !isTracking) {
          filteredParams.append(key, value);
        }
      }

      // Sort parameters for consistent ordering
      filteredParams.sort();
      absoluteUrl.search = filteredParams.toString();
    }

    // Handle hash/fragment
    if (!finalConfig.preserveHash) {
      absoluteUrl.hash = "";
    }

    // Remove trailing slash for consistency (except for root)
    let normalizedUrl = absoluteUrl.toString();
    if (normalizedUrl.endsWith("/") && absoluteUrl.pathname !== "/") {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }

    return Ok(normalizedUrl);
  } catch (error) {
    return Err({
      message: `Failed to normalize URL: ${url}`,
      cause: error,
    });
  }
};

/**
 * Check if a URL is internal to the given domain
 */
export const isInternalUrl = (
  url: string,
  baseDomain: string,
  includeSubdomains: boolean = true
): Result<boolean, UrlNormalizationError> => {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseDomain);

    // Different protocols are considered external
    if (urlObj.protocol !== baseObj.protocol) {
      return Ok(false);
    }

    const urlHostname = urlObj.hostname.toLowerCase();
    const baseHostname = baseObj.hostname.toLowerCase();

    if (includeSubdomains) {
      // Allow exact match or subdomain
      return Ok(urlHostname === baseHostname || urlHostname.endsWith(`.${baseHostname}`));
    } else {
      // Exact hostname match only
      return Ok(urlHostname === baseHostname);
    }
  } catch (error) {
    return Err({
      message: `Failed to check if URL is internal: ${url}`,
      cause: error,
    });
  }
};

/**
 * Check if a URL looks like a navigational page (not an asset or API)
 */
export const isNavigationalUrl = (url: string): Result<boolean, UrlNormalizationError> => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // File extensions that are typically not navigational pages
    const nonNavigationalExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".ico",
      ".css",
      ".js",
      ".json",
      ".xml",
      ".pdf",
      ".zip",
      ".tar",
      ".gz",
      ".mp4",
      ".avi",
      ".mov",
      ".mp3",
      ".wav",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
    ];

    // API patterns that are typically not navigational
    const apiPatterns = [
      "/api/",
      "/rest/",
      "/graphql",
      "/webhook",
      "/_next/",
      "/static/",
      "/assets/",
    ];

    // Check for non-navigational file extensions
    const hasNonNavExtension = nonNavigationalExtensions.some((ext) => pathname.endsWith(ext));

    // Check for API patterns
    const hasApiPattern = apiPatterns.some((pattern) => pathname.includes(pattern));

    return Ok(!hasNonNavExtension && !hasApiPattern);
  } catch (error) {
    return Err({
      message: `Failed to check if URL is navigational: ${url}`,
      cause: error,
    });
  }
};

/**
 * Extract the domain from a URL for comparison purposes
 */
export const extractDomain = (url: string): Result<string, UrlNormalizationError> => {
  try {
    const urlObj = new URL(url);
    return Ok(`${urlObj.protocol}//${urlObj.hostname.toLowerCase()}`);
  } catch (error) {
    return Err({
      message: `Failed to extract domain from URL: ${url}`,
      cause: error,
    });
  }
};

/**
 * Batch normalize multiple URLs with deduplication
 */
export const normalizeUrls = (
  urls: readonly string[],
  baseUrl?: string,
  config: Partial<UrlNormalizationConfig> = {}
): Result<string[], UrlNormalizationError> => {
  const normalizedSet = new Set<string>();
  const errors: string[] = [];

  for (const url of urls) {
    const result = normalizeUrl(url, baseUrl, config);

    if (result.ok) {
      normalizedSet.add(result.val);
    } else {
      errors.push(`${url}: ${result.val.message}`);
    }
  }

  if (errors.length > 0) {
    return Err({
      message: `Failed to normalize some URLs: ${errors.join(", ")}`,
    });
  }

  return Ok(Array.from(normalizedSet));
};
