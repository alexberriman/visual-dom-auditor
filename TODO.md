# ✅ TODO.md – Visual DOM QA CLI Tool

A Bun + TypeScript CLI tool that uses Playwright to launch a headless browser, scrolls the full page to load content, inspects for layout issues (overlap, broken padding, tight spacing), and outputs structured JSON.

---

## 📦 Project Setup

- [x] Create initial `README.md` with a short placeholder project description
- [x] Initialize Bun project (`bun init`)
- [x] Set up TypeScript config (`bun tsc --init`)
- [x] Install dependencies: `playwright`, `commander`, `zod`, `chalk`
- [x] Install dev dependencies: `@types/node`

---

## 📁 File Structure

- [x] Create `src/cli/index.ts` for CLI entrypoint
- [x] Create `src/core/browser.ts` for launching and preparing page
- [x] Create `src/core/analyzer.ts` to coordinate detection modules
- [x] Create `src/core/detectors/overlap.ts` for overlap detection
- [ ] Create `src/core/detectors/padding.ts` for padding detection
- [ ] Create `src/core/detectors/spacing.ts` for spacing detection
- [x] Create `src/types/issues.ts` to define issue types and Zod schema
- [x] Create `src/types/config.ts` for parsed CLI config types
- [ ] Create `src/utils/logger.ts` for debug logging

---

## 🧠 CLI Functionality

- [x] Accept `--url` argument (required)
- [x] Accept `--viewport` argument (`desktop`, `tablet`, `mobile`, or custom `widthxheight`)
- [x] Accept `--format` argument (`json`)
- [x] Accept `--save` argument to specify output file path
- [x] Parse, validate, and normalize CLI args

---

## 🌐 Browser & Page Setup

- [x] Launch headless Chromium via Playwright
- [x] Apply correct viewport dimensions based on `--viewport`
- [x] Navigate to the provided `--url`
- [x] Wait for page load (`load` or `networkidle`)
- [x] Scroll entire page top to bottom and back up to trigger lazy-loaded elements
- [x] Wait briefly to ensure DOM is stable after scrolling

---

## 🔍 Issue Detectors

- [x] Detect overlapping elements using bounding box comparison
- [ ] Detect buttons or elements with zero or broken padding
- [ ] Detect sibling elements with spacing below threshold (e.g., inline nav items, footer links)
- [ ] Detect container overflow detector - Detect if a child extends beyond the bounds of its parent container. Useful for layout bugs like horizontal scrollbars or broken grids.
  - [ ] Use bounding box comparison between parent and each child.
- [ ] Unexpected Scrollbars - Flag pages where layout is wider than the viewport due to rogue elements.
  - [ ] Horizontal scrolling (overflow-x) When it logically shouldn't (based on layout width)
- [ ] Broken Flex/Grid Layout Detector - Look for: Flex/grid containers with overflowing or squished children. Misused min-width, max-width, or gap
- [ ] Centering Failures - Detect horizontally or vertically "centered" elements that are actually misaligned


---

## 🧩 Analyzer Coordination

- [x] Run all detectors sequentially, not in parallel
- [x] Aggregate all results into a single list of issues
- [x] Generate metadata including URL, viewport, and timestamp
- [x] Validate results with Zod schema

---

## 📤 Output

- [x] If `--save` is provided, write JSON output to specified file
- [x] Otherwise, pretty-print JSON output to stdout

---

## 🧼 Finishing Touches

- [x] Add `bin` entry to `package.json` to enable global CLI usage
- [ ] Update the `README.md` with full usage instructions, examples, and make it sexy as fuck