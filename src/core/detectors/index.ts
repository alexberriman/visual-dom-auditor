import type { Detector } from "../analyzer";
import overlapDetector from "./overlap";
import paddingDetector from "./padding";
import spacingDetector from "./spacing";
import containerOverflowDetector from "./container-overflow";
import scrollbarDetector from "./scrollbar";
import flexGridDetector from "./flex-grid";
import centeringDetector from "./centering";

// Export individual detectors for direct usage
export { OverlapDetector } from "./overlap";
export { PaddingDetector } from "./padding";
export { SpacingDetector } from "./spacing";
export { ContainerOverflowDetector } from "./container-overflow";
export { ScrollbarDetector } from "./scrollbar";
export { FlexGridLayoutDetector } from "./flex-grid";
export { CenteringDetector } from "./centering";

// Export the default detector instances
export const detectors: Record<string, Detector> = {
  overlap: overlapDetector,
  padding: paddingDetector,
  spacing: spacingDetector,
  "container-overflow": containerOverflowDetector,
  scrollbar: scrollbarDetector,
  "flex-grid": flexGridDetector,
  // Centering detector disabled by default due to high rate of false positives
  // Include it explicitly if needed: import { centeringDetector } from "./detectors";
  // centering: centeringDetector,
};

// Add disabled detectors here if you want them to be available but not enabled by default
export const disabledDetectors: Record<string, Detector> = {
  centering: centeringDetector,
};

// Export an array of all detector instances
export const allDetectors: Detector[] = Object.values(detectors);

// Export default - the array of all detectors
export default allDetectors;
