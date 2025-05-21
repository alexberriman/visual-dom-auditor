# Visual DOM Auditor

<div align="center">
  
  ![Visual DOM Auditor Logo](https://via.placeholder.com/200x200.png?text=VDA)
  
  **A powerful CLI tool that detects critical layout issues on websites using headless browser technology.**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![npm version](https://img.shields.io/npm/v/@alexberriman/visual-dom-auditor.svg)](https://www.npmjs.com/package/@alexberriman/visual-dom-auditor)
  [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue)](https://www.typescriptlang.org/)
  
</div>

---

## ✨ Features

- **🤖 Automated Visual Testing:** Launches headless Chrome to render and analyze web pages
- **🧠 Smart Detection:** Identifies visual issues that traditional linters miss
- **📱 Responsive Testing:** Tests layouts across multiple device sizes (mobile, tablet, desktop)
- **🔍 Comprehensive Analysis:** Detects various layout issues:
  - Overlapping elements
  - Buttons with missing/broken padding
  - Elements with insufficient spacing
  - Container overflow issues
  - Unexpected scrollbars
  - Flex/Grid layout problems
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
visual-dom-auditor --url https://example.com
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
visual-dom-auditor --url https://example.com

# Test with a mobile viewport
visual-dom-auditor --url https://example.com --viewport mobile

# Use custom viewport dimensions
visual-dom-auditor --url https://example.com --viewport 1366x768

# Save results to a file
visual-dom-auditor --url https://example.com --save ./reports/audit.json
```

## 🧪 Detection Types

Visual DOM Auditor includes multiple specialized detectors that find common layout issues:

> **Note:** The centering detector is disabled by default due to a high rate of false positives. See [Advanced Configuration](#-advanced-configuration) to learn how to enable it.

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
  "position": {"x": 120, "y": 50}
}
```

### Padding Detector

Finds buttons and interactive elements with missing or insufficient padding.

```json
{
  "type": "padding",
  "element": {"selector": ".submit-button", "description": "Submit button"},
  "paddingValues": {"top": 0, "right": 4, "bottom": 0, "left": 4},
  "severity": "warning"
}
```

### Spacing Detector

Detects adjacent elements (like navigation items or footer links) with inadequate spacing.

### Container Overflow Detector

Identifies elements that extend beyond their parent containers.

### Scrollbar Detector

Flags unexpected horizontal scrollbars caused by content extending beyond viewport.

### Flex/Grid Layout Detector

Finds issues with flexible layouts, such as overflowing or squished children.

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
      - name: Install dependencies
        run: npm install -g @alexberriman/visual-dom-auditor
      - name: Run visual audit
        run: visual-dom-auditor --url https://staging.example.com --save report.json
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
    "totalIssuesFound": 3
  },
  "issues": [
    {
      "type": "overlap",
      "elements": [
        {"selector": "#header-logo", "description": "Site logo"},
        {"selector": "#nav-menu", "description": "Navigation menu"}
      ],
      "severity": "critical",
      "position": {"x": 150, "y": 50}
    },
    // Additional issues...
  ]
}
```

## 🗺️ Roadmap

- 📸 Auto-screenshot annotations
- 🧩 Plugin system for custom detectors
- 🔧 Self-healing CSS suggestions
- 🌐 Multi-URL batch processing
- 🎯 DOM targeting by area (header, footer, sidebar)

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