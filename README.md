# DOMQA

**DOMQA** is a CLI tool for detecting critical layout issues on webpages using a headless browser.

Built with **Bun + TypeScript + Playwright**, it programmatically loads a page, scrolls to trigger lazy-loaded content, and analyzes the rendered DOM for real, visual issues like:

- Overlapping elements
- Buttons with missing or broken padding
- Inline or adjacent elements with no spacing

This is *not* a linter, accessibility checker, or design audit tool — it focuses entirely on **hard rendering bugs** visible in the actual layout.

## Key Features

- Launches Chromium headlessly to render the target URL
- Supports custom and preset viewports (mobile, tablet, desktop)
- Scrolls the full page to trigger lazy content
- Detects visual bugs like:
  - Overlaps (e.g. nav over logo)
  - Zero-padding on buttons
  - Missing space between footer links or nav items
- Outputs results as structured JSON
- Works entirely from the CLI

## Example Use

```bash
bun run domqa --url https://example.com --viewport desktop --format json --save report.json
```

## Coming Soon

- Auto-screenshot annotation
- GitHub Action integration
- Self-healing CSS suggestions

## License

MIT
