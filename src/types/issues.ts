/**
 * Element location in the DOM
 */
export type ElementLocation = {
  readonly selector: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly textContent?: string; // Optional text content of the element
};

/**
 * Issue severity
 */
export type IssueSeverity = "critical" | "major" | "minor";

/**
 * Issue type
 */
export type IssueType =
  | "overlap"
  | "padding"
  | "spacing"
  | "container-overflow"
  | "scrollbar"
  | "layout"
  | "centering"
  | "console-error";

/**
 * Base issue interface
 */
export interface BaseIssue {
  readonly type: IssueType;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly elements: ElementLocation[];
}

/**
 * Overlap issue
 */
export interface OverlapIssue extends BaseIssue {
  readonly type: "overlap";
  readonly overlapArea: {
    readonly width: number;
    readonly height: number;
    readonly percentage: number;
  };
}

/**
 * Padding issue
 */
export interface PaddingIssue extends BaseIssue {
  readonly type: "padding";
  readonly sides: ("top" | "right" | "bottom" | "left")[];
  readonly computedPadding: Record<"top" | "right" | "bottom" | "left", number>;
}

/**
 * Spacing issue
 */
export interface SpacingIssue extends BaseIssue {
  readonly type: "spacing";
  readonly actualSpacing: number;
  readonly recommendedSpacing: number;
}

/**
 * Container overflow issue
 */
export interface ContainerOverflowIssue extends BaseIssue {
  readonly type: "container-overflow";
  readonly overflowAmount: {
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
    readonly left?: number;
  };
}

/**
 * Scrollbar issue
 */
export interface ScrollbarIssue extends BaseIssue {
  readonly type: "scrollbar";
  readonly direction: "horizontal" | "vertical";
  readonly causingElement?: ElementLocation;
}

/**
 * Layout issue
 */
export interface LayoutIssue extends BaseIssue {
  readonly type: "layout";
  readonly layoutType: "flex" | "grid";
  readonly problems: string[];
}

/**
 * Centering issue
 */
export interface CenteringIssue extends BaseIssue {
  readonly type: "centering";
  readonly axis: "horizontal" | "vertical" | "both";
  readonly offset: {
    readonly x?: number;
    readonly y?: number;
  };
}

/**
 * Console error issue
 */
export interface ConsoleErrorIssue extends BaseIssue {
  readonly type: "console-error";
  readonly level: "error" | "warning";
  readonly source: {
    readonly url?: string;
    readonly line?: number;
    readonly column?: number;
  };
  readonly stackTrace?: string;
}

/**
 * Union type of all issue types
 */
export type Issue =
  | OverlapIssue
  | PaddingIssue
  | SpacingIssue
  | ContainerOverflowIssue
  | ScrollbarIssue
  | LayoutIssue
  | CenteringIssue
  | ConsoleErrorIssue;

/**
 * Single URL audit result
 */
export type SingleUrlAuditResult = {
  readonly url: string;
  readonly timestamp: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly issues: Issue[];
  readonly metadata: {
    readonly totalIssuesFound: number;
    readonly criticalIssues: number;
    readonly majorIssues: number;
    readonly minorIssues: number;
    readonly issuesByType: Record<IssueType, number>;
  };
};

/**
 * Multi-URL audit result
 */
export type MultiUrlAuditResult = {
  readonly timestamp: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly results: SingleUrlAuditResult[];
  readonly summary: {
    readonly totalUrls: number;
    readonly urlsWithIssues: number;
    readonly totalIssuesFound: number;
    readonly criticalIssues: number;
    readonly majorIssues: number;
    readonly minorIssues: number;
    readonly issuesByType: Record<IssueType, number>;
  };
  readonly exitedEarly?: boolean;
};

/**
 * Crawl audit result (extends MultiUrlAuditResult with crawl metadata)
 */
export type CrawlAuditResult = MultiUrlAuditResult & {
  readonly crawlMetadata: {
    readonly startUrl: string;
    readonly maxDepthReached: number;
    readonly totalPagesDiscovered: number;
    readonly pagesSkipped: number;
    readonly crawlDuration: number;
    readonly averagePageTime: number;
    readonly successfulPages: number;
    readonly failedPages: number;
  };
};

/**
 * Audit result (backwards compatibility)
 */
export type AuditResult = SingleUrlAuditResult | MultiUrlAuditResult | CrawlAuditResult;
