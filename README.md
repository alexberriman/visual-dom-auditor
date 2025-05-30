<h1 align="center">Visual DOM Auditor</h1>

<div align="center">
  
  **A CLI tool for detecting layout issues on websites by analyzing the DOM using Playwright.**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![npm version](https://img.shields.io/npm/v/@alexberriman/visual-dom-auditor.svg)](https://www.npmjs.com/package/@alexberriman/visual-dom-auditor)
  [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue)](https://www.typescriptlang.org/)
  
</div>

<br>

<div align="center">
  <h3>🚀 Quick Start</h3>
  
  ```bash
  npx @alexberriman/visual-dom-auditor --url https://example.com
  ```
</div>

<br>

---

## 📖 Table of Contents

- [✨ Why Visual DOM Auditor?](#-why-visual-dom-auditor)
- [🔥 Features](#-features)
- [⚡ Installation](#-installation)
- [🎯 Quick Examples](#-quick-examples)
- [🛠️ Command Reference](#️-command-reference)
- [🧪 Detectors](#-detectors)
- [🕷️ Site Crawling](#️-site-crawling)
- [📊 Output Formats](#-output-formats)
- [🔄 CI/CD Integration](#-cicd-integration)
- [🎨 Advanced Usage](#-advanced-usage)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

---

## ✨ Why Visual DOM Auditor?

Your CSS looks perfect. Your code validates. But your site still breaks visually. **Visual DOM Auditor** catches what other tools miss — the real layout issues that frustrate users.

<div align="center">
  <br>
  <img src="https://img.shields.io/badge/Catches-Real%20Visual%20Bugs-ff6b6b?style=for-the-badge" alt="Catches Real Visual Bugs">
  <img src="https://img.shields.io/badge/CI%2FCD-Ready-4ecdc4?style=for-the-badge" alt="CI/CD Ready">
  <img src="https://img.shields.io/badge/Zero-Config-ffd93d?style=for-the-badge" alt="Zero Config">
  <br><br>
</div>

---

## 🔥 Features

<table>
  <tr>
    <td width="50%">
      <h3>🎯 Smart Detection</h3>
      <ul>
        <li>Overlapping elements</li>
        <li>Broken button padding</li>
        <li>Insufficient spacing</li>
        <li>Container overflows</li>
        <li>Unexpected scrollbars</li>
        <li>Flex/Grid layout issues</li>
        <li>Console errors</li>
      </ul>
    </td>
    <td width="50%">
      <h3>⚡ Powerful Testing</h3>
      <ul>
        <li>Test single or multiple URLs</li>
        <li>Responsive viewport testing</li>
        <li>Site-wide crawling</li>
        <li>Concurrent processing</li>
        <li>JSON output for automation</li>
        <li>CI/CD integration</li>
        <li>Early exit on critical issues</li>
      </ul>
    </td>
  </tr>
</table>

---

## ⚡ Installation

```bash
# Use directly (recommended)
npx @alexberriman/visual-dom-auditor --url https://example.com

# Or install globally
npm install -g @alexberriman/visual-dom-auditor
```

---

## 🎯 Quick Examples

### Basic Usage

```bash
# Analyze a single page
npx @alexberriman/visual-dom-auditor --url https://example.com

# Test mobile layout
npx @alexberriman/visual-dom-auditor --url https://example.com --viewport mobile

# Save results
npx @alexberriman/visual-dom-auditor --url https://example.com --save report.json
```

### Advanced Usage

```bash
# Test multiple pages with custom viewport
npx @alexberriman/visual-dom-auditor \
  --urls https://example.com https://example.com/about \
  --viewport 1366x768 \
  --save results.json

# Crawl entire site
npx @alexberriman/visual-dom-auditor \
  --url https://example.com \
  --crawl \
  --max-pages 50 \
  --max-threads 5

# Run specific detectors only
npx @alexberriman/visual-dom-auditor \
  --url https://example.com \
  --detectors "overlap,console-error"
```

---

## 🛠️ Command Reference

### Core Options

| Option | Description | Default |
|:-------|:------------|:--------|
| `--url` | Single URL to analyze | - |
| `--urls` | Multiple URLs to analyze | - |
| `--viewport` | `desktop`, `tablet`, `mobile`, or `WIDTHxHEIGHT` | `desktop` |
| `--save` | Save results to file | - |
| `--format` | Output format | `json` |
| `--verbose` | Show detailed logs | `false` |
| `--exit-early` | Stop on first critical error | `false` |

### Detector Options

| Option | Description | Default |
|:-------|:------------|:--------|
| `--detectors` | Comma-separated list of detectors | All enabled |

### Crawling Options

| Option | Description | Default |
|:-------|:------------|:--------|
| `--crawl` | Enable site crawling | `false` |
| `--max-depth` | Maximum crawl depth (1-10) | `3` |
| `--max-pages` | Maximum pages to crawl (1-1000) | `50` |
| `--max-threads` | Concurrent threads (1-10) | `3` |

---

## 🧪 Detectors

### 🎯 Enabled by Default

<details>
<summary><b>🔴 Overlap Detector</b> — Finds overlapping elements</summary>

```json
{
  "type": "overlap",
  "severity": "critical",
  "elements": [
    {"selector": ".header-logo", "description": "Header logo"},
    {"selector": ".nav-menu", "description": "Navigation menu"}
  ],
  "overlapPercentage": 65
}
```
</details>

<details>
<summary><b>📏 Padding Detector</b> — Checks button/link padding</summary>

```json
{
  "type": "padding",
  "severity": "major",
  "element": {"selector": ".submit-btn", "description": "Submit button"},
  "insufficientSides": ["top", "bottom"]
}
```
</details>

<details>
<summary><b>↔️ Spacing Detector</b> — Validates element spacing</summary>

```json
{
  "type": "spacing",
  "severity": "minor",
  "spacing": 2,
  "recommendedSpacing": 8
}
```
</details>

<details>
<summary><b>📦 Container Overflow</b> — Detects content overflow</summary>

```json
{
  "type": "container-overflow",
  "severity": "major",
  "overflowDirection": "right",
  "overflowAmount": 15
}
```
</details>

<details>
<summary><b>📜 Scrollbar Detector</b> — Finds unwanted scrollbars</summary>

```json
{
  "type": "scrollbar",
  "severity": "critical",
  "overflowAmount": 320
}
```
</details>

<details>
<summary><b>🎨 Flex/Grid Detector</b> — Layout system issues</summary>

```json
{
  "type": "flex-grid",
  "severity": "major",
  "issue": "overflow"
}
```
</details>

<details>
<summary><b>🚨 Console Error Detector</b> — JavaScript errors</summary>

```json
{
  "type": "console-error",
  "severity": "critical",
  "level": "error",
  "message": "TypeError: Cannot read property 'foo' of undefined"
}
```
</details>

### 🔵 Disabled by Default

- **Centering Detector** — Enable with `--detectors centering`

---

## 🕷️ Site Crawling

Automatically discover and analyze your entire website.

```bash
# Basic crawl
npx @alexberriman/visual-dom-auditor --url https://example.com --crawl

# Advanced crawl with limits
npx @alexberriman/visual-dom-auditor \
  --url https://example.com \
  --crawl \
  --max-depth 5 \
  --max-pages 100 \
  --max-threads 5 \
  --save crawl-report.json
```

### How It Works

1. **🚀 Starts** from your URL
2. **🔍 Discovers** internal links
3. **🧹 Filters** external/asset links
4. **⚡ Analyzes** pages concurrently
5. **📊 Reports** aggregated results

---

## 📊 Output Formats

### Single URL

```json
{
  "url": "https://example.com",
  "timestamp": "2023-05-20T10:15:30Z",
  "issues": [...],
  "metadata": {
    "totalIssuesFound": 3,
    "criticalIssues": 1,
    "issuesByType": {...}
  }
}
```

### Multiple URLs / Crawl

```json
{
  "timestamp": "2023-05-20T10:15:30Z",
  "results": [...],
  "summary": {
    "totalUrls": 15,
    "urlsWithIssues": 8,
    "totalIssuesFound": 23
  },
  "crawlMetadata": {
    "startUrl": "https://example.com",
    "pagesSkipped": 32,
    "crawlDuration": 45000
  }
}
```

---

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Visual Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Playwright
        run: npx playwright install chromium
      - name: Run Visual Audit
        run: |
          npx @alexberriman/visual-dom-auditor \
            --url https://staging.example.com \
            --crawl \
            --exit-early \
            --save report.json
      - uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: report.json
```

### Quick CI Commands

```bash
# Fail fast on critical issues
npx @alexberriman/visual-dom-auditor --url $STAGING_URL --exit-early

# Full site audit
npx @alexberriman/visual-dom-auditor --url $STAGING_URL --crawl --max-pages 25
```

---

## 🎨 Advanced Usage

### Pipe to Other Tools

```bash
# Pretty print with jq
npx @alexberriman/visual-dom-auditor --url https://example.com | jq '.'

# Extract critical issues
npx @alexberriman/visual-dom-auditor --url https://example.com | \
  jq '.issues[] | select(.severity == "critical")'

# Count issues by type
npx @alexberriman/visual-dom-auditor --url https://example.com | \
  jq '.metadata.issuesByType'
```

### Programmatic Usage

```javascript
import { analyzePage } from "@alexberriman/visual-dom-auditor/core/analyzer";
import { allDetectors } from "@alexberriman/visual-dom-auditor/core/detectors";

// Custom analysis
const result = await analyzePage(page, config, allDetectors);
```

---

## 🤝 Contributing

We love contributions! Check out our [contributing guide](CONTRIBUTING.md) to get started.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/visual-dom-auditor
cd visual-dom-auditor

# Install dependencies
npm install

# Make your changes
# ...

# Test
npm test

# Submit PR
```

---

## 📜 License

MIT © [Alex Berriman](https://github.com/alexberriman)

<div align="center">
  <br>
  <sub>Built with ❤️ to make the web more visually perfect</sub>
</div>