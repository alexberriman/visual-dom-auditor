import { chromium, type Page, type Browser } from "playwright-core";
import { Result, Ok, Err } from "ts-results";
import type { Config } from "../types/config";

type BrowserError = {
  message: string;
  cause?: unknown;
};

/**
 * Launch a headless browser instance
 */
const launchBrowser = async (): Promise<Result<Browser, BrowserError>> => {
  try {
    const browser = await chromium.launch({ headless: true });
    return Ok(browser);
  } catch (error) {
    return Err({
      message: "Failed to launch browser",
      cause: error,
    });
  }
};

/**
 * Open a new page and navigate to the specified URL
 */
const openPage = async (browser: Browser, url: string): Promise<Result<Page, BrowserError>> => {
  try {
    const page = await browser.newPage();

    // Navigate to the URL and wait for the page to load
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    if (!response || !response.ok()) {
      return Err({
        message: `Failed to load URL: ${url}. Status: ${response?.status() || "unknown"}`,
      });
    }

    return Ok(page);
  } catch (error) {
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
  height: number
): Promise<Result<void, BrowserError>> => {
  try {
    await page.setViewportSize({ width, height });
    return Ok(undefined);
  } catch (error) {
    return Err({
      message: `Failed to set viewport size to ${width}x${height}`,
      cause: error,
    });
  }
};

/**
 * Scroll the page to trigger lazy-loaded elements
 */
const scrollPage = async (page: Page): Promise<Result<void, BrowserError>> => {
  try {
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

    return Ok(undefined);
  } catch (error) {
    return Err({
      message: "Failed to scroll page",
      cause: error,
    });
  }
};

/**
 * Wait for the page to be stable (no more layout shifts or network activity)
 */
const waitForStability = async (page: Page): Promise<Result<void, BrowserError>> => {
  try {
    // Wait a moment for any javascript to finish executing
    await page.waitForTimeout(500);

    // Wait for a stable load state
    await page.waitForLoadState("networkidle");

    return Ok(undefined);
  } catch (error) {
    return Err({
      message: "Failed while waiting for page stability",
      cause: error,
    });
  }
};

/**
 * Prepares a browser page for analysis
 *
 * 1. Launches a headless browser
 * 2. Opens a page with the specified URL
 * 3. Sets the viewport size
 * 4. Scrolls the page to trigger lazy-loaded elements
 * 5. Waits for the page to be stable
 */
export const preparePage = async (
  config: Config
): Promise<Result<{ browser: Browser; page: Page }, BrowserError>> => {
  // Launch browser
  const browserResult = await launchBrowser();
  if (browserResult.err) {
    return Err(browserResult.val);
  }

  const browser = browserResult.val;

  // Open page
  const pageResult = await openPage(browser, config.url);
  if (pageResult.err) {
    await browser.close();
    return Err(pageResult.val);
  }

  const page = pageResult.val;

  // Set viewport
  const viewportResult = await setViewport(page, config.viewport.width, config.viewport.height);
  if (viewportResult.err) {
    await browser.close();
    return Err(viewportResult.val);
  }

  // Scroll page
  const scrollResult = await scrollPage(page);
  if (scrollResult.err) {
    await browser.close();
    return Err(scrollResult.val);
  }

  // Wait for stability
  const stabilityResult = await waitForStability(page);
  if (stabilityResult.err) {
    await browser.close();
    return Err(stabilityResult.val);
  }

  return Ok({ browser, page });
};

/**
 * Safely closes the browser
 */
export const closeBrowser = async (browser: Browser): Promise<void> => {
  await browser.close();
};
