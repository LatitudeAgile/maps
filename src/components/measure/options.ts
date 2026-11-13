// The measure component's option values, apart from the element so the registry can use them
// without loading it.
export const MEASURE_TOOLS = ["distance", "area"] as const;
export type MeasureTool = (typeof MEASURE_TOOLS)[number];
export const MEASURE_UNITS = ["imperial", "metric"] as const;
export type MeasureUnit = (typeof MEASURE_UNITS)[number];
