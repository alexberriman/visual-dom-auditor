import { chromium, type Page, type Browser } from "playwright-core";
import { Ok, Err, type Result } from "../types/ts-results";
import type { Config } from "../types/config";
import type { ConsoleErrorDetector } from "./detectors/console-error";
import { spinner } from "../utils/spinner";
import { ContextSpinner } from "../utils/context-spinner";
import { formatBrowser, conditionalFormat } from "../utils/colors";
import { setLoggerUrlContext } from "../utils/logger";

type BrowserError = {
  message: string;
  cause?: unknown;
};

/**
 * Launch a headless browser instance
 */
const launchBrowser = async (): Promise<Result<Browser, BrowserError>> => {
  try {
    const browserName = conditionalFormat("Chromium", formatBrowser);
    // Clear URL context for browser-level operations
    spinner.setUrlContext(null);
    setLoggerUrlContext(null);
    spinner.start(`🚀 Launching ${browserName} browser...`, { color: "blue", spinner: "dots" });
    const browser = await chromium.launch({ headless: true });
    spinner.succeed(`✓ ${browserName} browser launched successfully`);
    return Ok(browser);
  } catch (error) {
    spinner.fail("❌ Failed to launch browser");
    return Err({
      message: "Failed to launch browser",
      cause: error,
    });
  }
};

/**
 * Open a new page and navigate to the specified URL
 */
const openPage = async (
  browser: Browser,
  url: string,
  consoleDetector?: ConsoleErrorDetector
): Promise<Result<Page, BrowserError>> => {
  // Create a context-aware spinner for this specific URL
  const contextSpinner = ContextSpinner.create(url);

  try {
    // Set logger context for this operation
    setLoggerUrlContext(url);
    contextSpinner.start(`🌐 Loading page...`, { color: "cyan", spinner: "dots2" });

    const page = await browser.newPage();

    // Start listening for console errors before navigation if detector provided
    if (consoleDetector) {
      consoleDetector.startListeningEarly(page);
    }

    // Navigate to the URL and wait for the page to load
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    if (!response || !response.ok()) {
      contextSpinner.fail(`❌ Failed to load page (Status: ${response?.status() || "unknown"})`);
      return Err({
        message: `Failed to load URL: ${url}. Status: ${response?.status() || "unknown"}`,
      });
    }

    contextSpinner.succeed(`✓ Page loaded successfully`);
    return Ok(page);
  } catch (error) {
    contextSpinner.fail(`❌ Failed to load page`);
    return Err({
      message: `Failed to open page at URL: ${url}`,
      cause: error,
    });
  }
};

/**
 * Set the viewport size for the page
 */
const setViewport = async (
  page: Page,
  width: number,
  height: number,
  urlContext?: string | null
): Promise<Result<void, BrowserError>> => {
  // Create a context-aware spinner
  const contextSpinner = ContextSpinner.create(urlContext || null);

  try {
    contextSpinner.start(`📐 Setting viewport to ${width}×${height}...`, {
      color: "yellow",
      spinner: "dots3",
    });
    await page.setViewportSize({ width, height });
    contextSpinner.succeed(`✓ Viewport set to ${width}×${height}`);
    return Ok(undefined);
  } catch (error) {
    contextSpinner.fail(`❌ Failed to set viewport size`);
    return Err({
      message: `Failed to set viewport size to ${width}x${height}`,
      cause: error,
    });
  }
};

/**
 * Scroll the page to trigger lazy-loaded elements
 */
const scrollPage = async (
  page: Page,
  urlContext?: string | null
): Promise<Result<void, BrowserError>> => {
  // Create a context-aware spinner
  const contextSpinner = ContextSpinner.create(urlContext || null);

  try {
    contextSpinner.start("📜 Scrolling page to load content...", {
      color: "magenta",
      spinner: "dots4",
    });

    // Scroll to the bottom of the page in small increments
    // Using page.evaluate() which runs in the browser context where document/window are available
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    for (let scrollY = 0; scrollY < scrollHeight; scrollY += viewportHeight / 2) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      // Wait a short time between scrolls to let content load
      await page.waitForTimeout(200);
    }

    // Scroll back to the top
    await page.evaluate(() => window.scrollTo(0, 0));

    contextSpinner.succeed("✓ Page content loaded");
    return Ok(undefined);
  } catch (error) {
    contextSpinner.fail("❌ Failed to scroll page");
    return Err({
      message: "Failed to scroll page",
      cause: error,
    });
  }
};

/**
 * Wait for the page to be stable (no more layout shifts, network activity, or animations)
 */
const waitForStability = async (
  page: Page,
  urlContext?: string | null
): Promise<Result<void, BrowserError>> => {
  // Create a context-aware spinner
  const contextSpinner = ContextSpinner.create(urlContext || null);

  try {
    contextSpinner.start("⏳ Waiting for page to stabilize...", {
      color: "green",
      spinner: "dots5",
    });

    // Wait for network activity to complete
    await page.waitForLoadState("networkidle");

    // Wait for any JavaScript to finish executing
    await page.waitForTimeout(500);

    // Wait for animations to complete
    // Most modern animation libraries (including Framer Motion) use CSS transitions/animations
    // or requestAnimationFrame, which typically complete within 1-2 seconds
    const ANIMATION_WAIT_TIME = 2000; // 2 seconds should cover most animations

    await page.waitForTimeout(ANIMATION_WAIT_TIME);

    // Optional: Check if animations are still in progress
    const animationsInProgress = await page.evaluate(() => {
      // Check for CSS animations
      const animatingElements = document.querySelectorAll("*");
      let hasActiveAnimations = false;

      // Convert NodeList to Array to ensure iterator is available
      const elementsArray = Array.from(animatingElements);
      for (const element of elementsArray) {
        const styles = window.getComputedStyle(element);
        if (
          styles.animationName !== "none" ||
          styles.transition !== "all 0s ease 0s" ||
          element.classList.contains("animate-") ||
          element.getAttribute("data-framer-motion") // Framer Motion adds this attribute
        ) {
          hasActiveAnimations = true;
          break;
        }
      }

      return hasActiveAnimations;
    });

    if (animationsInProgress) {
      contextSpinner.update("⏳ Waiting for animations to complete...");
      // Wait a bit longer if animations are still detected
      await page.waitForTimeout(1000);
    }

    // Scroll back to top once more to ensure we're at the correct position for analysis
    await page.evaluate(() => window.scrollTo(0, 0));

    // Final short wait to ensure everything is settled
    await page.waitForTimeout(300);

    contextSpinner.succeed("✓ Page is ready for analysis");
    return Ok(undefined);
  } catch (error) {
    contextSpinner.fail("❌ Failed to stabilize page");
    return Err({
      message: "Failed while waiting for page stability",
      cause: error,
    });
  }
};

/**
 * Prepares a browser page for analysis with a specific URL
 *
 * 1. Opens a page with the specified URL using existing browser
 * 2. Sets the viewport size
 * 3. Scrolls the page to trigger lazy-loaded elements
 * 4. Waits for the page to be stable
 */
export const preparePageForUrl = async (
  browser: Browser,
  url: string,
  viewport: { width: number; height: number },
  consoleDetector?: ConsoleErrorDetector
): Promise<Result<Page, BrowserError>> => {
  // Open page with console error detection
  const pageResult = await openPage(browser, url, consoleDetector);
  if (pageResult.err) {
    return Err(pageResult.val);
  }

  const page = pageResult.val;

  // Set viewport with URL context
  const viewportResult = await setViewport(page, viewport.width, viewport.height, url);
  if (viewportResult.err) {
    await page.close();
    return Err(viewportResult.val);
  }

  // Scroll page with URL context
  const scrollResult = await scrollPage(page, url);
  if (scrollResult.err) {
    await page.close();
    return Err(scrollResult.val);
  }

  // Wait for stability with URL context
  const stabilityResult = await waitForStability(page, url);
  if (stabilityResult.err) {
    await page.close();
    return Err(stabilityResult.val);
  }

  return Ok(page);
};

/**
 * Prepares a browser page for analysis (legacy single URL support)
 */
export const preparePage = async (
  config: Config,
  consoleDetector?: ConsoleErrorDetector
): Promise<Result<{ browser: Browser; page: Page }, BrowserError>> => {
  // Launch browser
  const browserResult = await launchBrowser();
  if (browserResult.err) {
    return Err(browserResult.val);
  }

  const browser = browserResult.val;

  // Use the first URL for backwards compatibility
  const url = config.urls[0];
  if (!url) {
    await browser.close();
    return Err({ message: "No URLs provided in config" });
  }

  const pageResult = await preparePageForUrl(browser, url, config.viewport, consoleDetector);
  if (pageResult.err) {
    await browser.close();
    return Err(pageResult.val);
  }

  return Ok({ browser, page: pageResult.val });
};

/**
 * Safely closes the browser
 */
export const closeBrowser = async (browser: Browser): Promise<void> => {
  await browser.close();
};
