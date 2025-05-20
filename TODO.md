# ✅ TODO.md – Visual DOM QA CLI Tool

A Bun + TypeScript CLI tool that uses Playwright to launch a headless browser, scrolls the full page to load content, inspects for layout issues (overlap, broken padding, tight spacing), and outputs structured JSON.

---

## 📦 Project Setup

- [ ] Create initial `README.md` with a short placeholder project description
- [ ] Initialize Bun project (`bun init`)
- [ ] Set up TypeScript config (`bun tsc --init`)
- [ ] Install dependencies: `playwright`, `commander`, `zod`, `chalk`
- [ ] Install dev dependencies: `@types/node`

---

## 📁 File Structure

- [ ] Create `src/cli/index.ts` for CLI entrypoint
- [ ] Create `src/core/browser.ts` for launching and preparing page
- [ ] Create `src/core/analyzer.ts` to coordinate detection modules
- [ ] Create `src/core/detectors/overlap.ts` for overlap detection
- [ ] Create `src/core/detectors/padding.ts` for padding detection
- [ ] Create `src/core/detectors/spacing.ts` for spacing detection
- [ ] Create `src/types/issues.ts` to define issue types and Zod schema
- [ ] Create `src/types/config.ts` for parsed CLI config types
- [ ] Create `src/utils/logger.ts` for debug logging

---

## 🧠 CLI Functionality

- [ ] Accept `--url` argument (required)
- [ ] Accept `--viewport` argument (`desktop`, `tablet`, `mobile`, or custom `widthxheight`)
- [ ] Accept `--format` argument (`json`)
- [ ] Accept `--save` argument to specify output file path
- [ ] Parse, validate, and normalize CLI args

---

## 🌐 Browser & Page Setup

- [ ] Launch headless Chromium via Playwright
- [ ] Apply correct viewport dimensions based on `--viewport`
- [ ] Navigate to the provided `--url`
- [ ] Wait for page load (`load` or `networkidle`)
- [ ] Scroll entire page top to bottom and back up to trigger lazy-loaded elements
- [ ] Wait briefly to ensure DOM is stable after scrolling

---

## 🔍 Issue Detectors

- [ ] Detect overlapping elements using bounding box comparison
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

- [ ] Run all detectors sequentially, not in parallel
- [ ] Aggregate all results into a single list of issues
- [ ] Generate metadata including URL, viewport, and timestamp
- [ ] Validate results with Zod schema

---

## 📤 Output

- [ ] If `--save` is provided, write JSON output to specified file
- [ ] Otherwise, pretty-print JSON output to stdout

---

## 🧼 Finishing Touches

- [ ] Add `bin` entry to `package.json` to enable global CLI usage
- [ ] Update the `README.md` with full usage instructions, examples, and make it sexy as fuck
