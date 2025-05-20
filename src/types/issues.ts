/**
 * Element location in the DOM
 */
export type ElementLocation = {
  readonly selector: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
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
  | "centering";

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
 * Union type of all issue types
 */
export type Issue =
  | OverlapIssue
  | PaddingIssue
  | SpacingIssue
  | ContainerOverflowIssue
  | ScrollbarIssue
  | LayoutIssue
  | CenteringIssue;

/**
 * Audit result
 */
export type AuditResult = {
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
