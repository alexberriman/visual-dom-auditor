<h1 align="center">Visual DOM Auditor</h1>

<div align="center">
  
  **A CLI tool for detecting layout issues on websites by analyzing the DOM using Playwright.**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![npm version](https://img.shields.io/npm/v/@alexberriman/visual-dom-auditor.svg)](https://www.npmjs.com/package/@alexberriman/visual-dom-auditor)
  [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue)](https://www.typescriptlang.org/)
  
</div>

---

## ✨ Features

- **🤖 Automated Visual Testing:** Launches headless browser to render and analyze web pages
- **🧠 Smart Detection:** Identifies visual issues that traditional linters miss
- **📱 Responsive Testing:** Tests layouts across multiple device sizes (mobile, tablet, desktop)
- **🔍 Comprehensive Analysis:** Detects various layout issues:
  - Overlapping elements
  - Buttons with missing/broken padding
  - Elements with insufficient spacing
  - Container overflow issues
  - Unexpected scrollbars
  - Flex/Grid layout problems
  - Centering issues (disabled by default)
- **📊 Structured Output:** Exports detailed reports in JSON format
- **🔄 CI/CD Integration:** Easily integrates with GitHub Actions and other CI pipelines

## 🚀 Installation

```bash
# Install globally
npm install -g @alexberriman/visual-dom-auditor

# Or use with npx without installing
npx @alexberriman/visual-dom-auditor --url https://example.com
```

## 📋 Usage

```bash
# If installed globally
visual-dom-auditor --url https://example.com

# Without installing (recommended)
npx @alexberriman/visual-dom-auditor --url https://example.com
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | URL of the website to analyze (required) | - |
| `--viewport <viewport>` | Viewport size: `desktop`, `tablet`, `mobile`, or custom `widthxheight` (e.g., `1366x768`) | `desktop` (1920x1080) |
| `--format <format>` | Output format | `json` |
| `--save <path>` | Save output to file (e.g., `./reports/audit.json`) | - |

### Examples

```bash
# Basic usage (outputs to console)
npx @alexberriman/visual-dom-auditor --url https://example.com

# Test with a mobile viewport
npx @alexberriman/visual-dom-auditor --url https://example.com --viewport mobile

# Use custom viewport dimensions
npx @alexberriman/visual-dom-auditor --url https://example.com --viewport 1366x768

# Save results to a file
npx @alexberriman/visual-dom-auditor --url https://example.com --save ./reports/audit.json
```

## 🧪 Detection Types

Visual DOM Auditor includes multiple specialized detectors that find common layout issues:

> **Note:** The centering detector is disabled by default due to a high rate of false positives. See [Advanced Configuration](#%EF%B8%8F-advanced-configuration) to learn how to enable it.

### Overlap Detector

Identifies elements that visually overlap, which may indicate z-index issues or positioning bugs.

```json
{
  "type": "overlap",
  "elements": [
    {"selector": ".header-logo", "description": "Header logo"},
    {"selector": ".main-nav", "description": "Navigation menu"}
  ],
  "severity": "critical",
  "position": {"x": 120, "y": 50},
  "overlapPercentage": 65
}
```

### Padding Detector

Finds buttons and interactive elements with missing or insufficient padding, harming usability.

```json
{
  "type": "padding",
  "element": {"selector": ".submit-button", "description": "Submit button"},
  "paddingValues": {"top": 0, "right": 4, "bottom": 0, "left": 4},
  "insufficientSides": ["top", "bottom", "left"],
  "severity": "major"
}
```

### Spacing Detector

Detects adjacent elements (like navigation items or footer links) with inadequate spacing.

```json
{
  "type": "spacing",
  "elements": [
    {"selector": ".nav-item:nth-child(1)", "description": "Navigation item"},
    {"selector": ".nav-item:nth-child(2)", "description": "Navigation item"}
  ],
  "spacing": 2,
  "recommendedSpacing": 8,
  "severity": "minor"
}
```

### Container Overflow Detector

Identifies elements that extend beyond their parent containers, breaking layouts.

```json
{
  "type": "container-overflow",
  "elements": {
    "child": {"selector": ".product-image", "description": "Product image"},
    "parent": {"selector": ".product-card", "description": "Product card"}
  },
  "overflowDirection": "right",
  "overflowAmount": 15,
  "severity": "major"
}
```

### Scrollbar Detector

Flags unexpected horizontal scrollbars caused by content extending beyond viewport.

```json
{
  "type": "scrollbar",
  "element": {"selector": ".content-section", "description": "Content section"},
  "overflowAmount": 320,
  "severity": "critical"
}
```

### Flex/Grid Layout Detector

Finds issues with flexible layouts, such as overflowing or squished flex/grid children.

```json
{
  "type": "flex-grid",
  "container": {"selector": ".grid-container", "description": "Grid container"},
  "problematicChildren": [
    {"selector": ".grid-item:nth-child(3)", "description": "Grid item"}
  ],
  "issue": "overflow",
  "severity": "major"
}
```

## 🔄 CI/CD Integration

Visual DOM Auditor can be integrated into your continuous integration workflow:

### GitHub Actions Example

```yaml
name: Layout Validation

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install Playwright browsers
        run: npx playwright install chromium
      - name: Run visual audit
        run: npx @alexberriman/visual-dom-auditor --url https://staging.example.com --save report.json
      - name: Archive results
        uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: report.json
```

## 📊 Interpreting Results

The tool outputs a structured JSON report with the following format:

```json
{
  "metadata": {
    "url": "https://example.com",
    "timestamp": "2023-05-20T10:15:30Z",
    "viewport": {"width": 1920, "height": 1080},
    "totalIssuesFound": 3,
    "criticalIssues": 1,
    "majorIssues": 1,
    "minorIssues": 1,
    "issuesByType": {
      "overlap": 1,
      "padding": 1,
      "spacing": 1,
      "container-overflow": 0,
      "scrollbar": 0,
      "layout": 0,
      "centering": 0
    }
  },
  "issues": [
    {
      "type": "overlap",
      "elements": [
        {"selector": "#header-logo", "description": "Site logo"},
        {"selector": "#nav-menu", "description": "Navigation menu"}
      ],
      "severity": "critical",
      "position": {"x": 150, "y": 50},
      "overlapPercentage": 75
    },
    // Additional issues...
  ]
}
```


## ⚙️ Advanced Configuration

### Enabling Disabled Detectors

Some detectors (such as the centering detector) are disabled by default due to generating too many false positives. You can enable them in your code by importing them directly:

```javascript
import { analyzePage } from "@alexberriman/visual-dom-auditor/core/analyzer";
import { allDetectors, disabledDetectors } from "@alexberriman/visual-dom-auditor/core/detectors";

// Create a custom detectors array with all detectors including disabled ones
const myDetectors = [...allDetectors, disabledDetectors.centering];

// Use the custom detectors array with the analyzer
const result = await analyzePage(page, config, myDetectors);
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.