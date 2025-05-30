/**
 * Color utility functions for terminal output
 * Uses ANSI escape codes for coloring and formatting
 */

/**
 * ANSI color codes
 */
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright colors
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",
} as const;

/**
 * Available colors for URL prefixes (excluding colors that are hard to read)
 */
const urlColors: Array<keyof typeof colors> = [
  "brightBlue",
  "brightGreen",
  "brightCyan",
  "brightMagenta",
  "brightYellow",
  "blue",
  "green",
  "cyan",
  "magenta",
  "yellow",
];

/**
 * Simple hash function to convert string to number
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Get a consistent color for a given URL
 */
const getUrlColor = (url: string): keyof typeof colors => {
  try {
    // Use just the domain for color selection to keep consistency across paths
    const domain = new URL(url).hostname;
    const hash = hashString(domain);
    const colorIndex = hash % urlColors.length;
    return urlColors[colorIndex];
  } catch {
    // Fallback to default color if URL parsing fails
    return "brightBlue";
  }
};

/**
 * Format text with the given color and optionally bold
 */
const formatText = (text: string, color: keyof typeof colors, bold = false): string => {
  const colorCode = colors[color];
  const boldCode = bold ? colors.bold : "";
  return `${boldCode}${colorCode}${text}${colors.reset}`;
};

/**
 * Format a URL for display with brackets, bold, and color
 * Example: [example.com] in bold with a consistent color based on domain
 */
export const formatUrl = (url: string): string => {
  const color = getUrlColor(url);
  try {
    const domain = new URL(url).hostname;
    return formatText(`[${domain}]`, color, true);
  } catch {
    // Fallback if URL parsing fails
    return formatText(`[${url}]`, color, true);
  }
};

/**
 * Format browser name for display in bold color
 * Example: Chromium in bold magenta
 */
export const formatBrowser = (browserName: string): string => {
  return formatText(browserName, "brightMagenta", true);
};

/**
 * Format status text with appropriate color
 */
export const formatStatus = (
  text: string,
  type: "success" | "error" | "warning" | "info"
): string => {
  switch (type) {
    case "success":
      return formatText(text, "brightGreen", true);
    case "error":
      return formatText(text, "brightRed", true);
    case "warning":
      return formatText(text, "brightYellow", true);
    case "info":
      return formatText(text, "brightCyan", true);
    default:
      return text;
  }
};

/**
 * Check if colors should be disabled (for non-TTY or CI environments)
 */
export const shouldUseColors = (): boolean => {
  return process.stdout.isTTY && !process.env.CI && process.env.NODE_ENV !== "test";
};

/**
 * Conditionally format text only if colors are enabled
 */
export const conditionalFormat = (_text: string, formatter: (_text: string) => string): string => {
  return shouldUseColors() ? formatter(_text) : _text;
};

/**
 * Create a URL prefix for log messages with consistent color based on domain
 * Example: "[example.com] Loading page..." or "[example.com/path] Processing..."
 */
export const createUrlPrefix = (url: string): string => {
  const color = getUrlColor(url);
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;

    // Show just domain for root paths, domain + path for nested paths
    const displayUrl = path === "/" || path === "" ? domain : `${domain}${path}`;
    return conditionalFormat(`[${displayUrl}]`, (text) => formatText(text, color, true));
  } catch {
    // Fallback if URL parsing fails
    return conditionalFormat(`[${url}]`, (text) => formatText(text, color, true));
  }
};

/**
 * Prefix a message with a URL
 * Example: "[example.com] Loading page..."
 */
export const prefixWithUrl = (url: string, message: string): string => {
  const prefix = createUrlPrefix(url);
  return `${prefix} ${message}`;
};
