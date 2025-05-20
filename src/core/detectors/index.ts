import type { Detector } from "../analyzer";
import overlapDetector from "./overlap";
import paddingDetector from "./padding";
import spacingDetector from "./spacing";

// Export individual detectors for direct usage
export { OverlapDetector } from "./overlap";
export { PaddingDetector } from "./padding";
export { SpacingDetector } from "./spacing";

// Export the default detector instances
export const detectors: Record<string, Detector> = {
  overlap: overlapDetector,
  padding: paddingDetector,
  spacing: spacingDetector,
};

// Export an array of all detector instances
export const allDetectors: Detector[] = Object.values(detectors);

// Export default - the array of all detectors
export default allDetectors;
