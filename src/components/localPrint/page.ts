// The printed map page (Letter, portrait or landscape), shared by the print area on the map
// (frame.ts) and the PDF (pdf.ts), so the frame always matches what prints. Ported unchanged from
// StewardshipOS src/print/mapPage.ts (3d-print D2). The page has no header or footer: a centered
// title above the map; below it the date and the legend on the left, the scale and credits on the
// right.

const PAGE = { width: 8.5, height: 11 }; // inches, portrait
export const MAP_PAGE_MARGINS = { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 };
// Room on the page above the map (title) and below it (date, then the legend beside the scale,
// in fixed columns)
export const TITLE_HEIGHT = 0.5;
const LEGEND = {
  landscape: { columns: 4, below: 1.35 }, // 3 rows
  portrait: { columns: 3, below: 1.5 }, // 4 rows
};
// Image resolution for the map, the usual print standard.
export const MAP_DPI = 300;

export interface MapPage {
  landscape: boolean;
  // The page's printable height, inside the margins
  contentHeight: number;
  // The map frame on paper, in inches
  mapWidth: number;
  mapHeight: number;
  legendColumns: number;
}

// The map's shape (width / height), the same as the map frames of Esri's Letter ANSI A layouts
// (10 x 6.25 in landscape, 7.5 x 8 in portrait), so the print area matches the Esri print
// component's. The map is as large as fits on the page in that shape, centered. Only the shape is
// Esri's, not the size: 10 x 6.25 in doesn't fit on landscape Letter with the title and legend,
// so the map is 9.36 x 5.85 in (7.69 x 8.2 in portrait), a 2808 x 1755 px image at 300 DPI.
const MAP_RATIO = { landscape: 10 / 6.25, portrait: 7.5 / 8 };

export function mapPage(landscape: boolean): MapPage {
  const width = landscape ? PAGE.height : PAGE.width;
  const height = landscape ? PAGE.width : PAGE.height;
  const contentHeight = height - MAP_PAGE_MARGINS.top - MAP_PAGE_MARGINS.bottom;
  const legend = LEGEND[landscape ? "landscape" : "portrait"];
  const ratio = MAP_RATIO[landscape ? "landscape" : "portrait"];
  const room = {
    width: width - MAP_PAGE_MARGINS.left - MAP_PAGE_MARGINS.right,
    height: contentHeight - TITLE_HEIGHT - legend.below,
  };
  const mapWidth = Math.min(room.width, room.height * ratio);
  return {
    landscape,
    contentHeight,
    mapWidth,
    mapHeight: mapWidth / ratio,
    legendColumns: legend.columns,
  };
}

/** The page's size in inches, in the chosen orientation. */
export function pageSize(landscape: boolean): { width: number; height: number } {
  return landscape ? { width: PAGE.height, height: PAGE.width } : { ...PAGE };
}

export interface ScaleBar {
  label: string;
  inches: number;
  // Tick labels along the bar, at 0, half and the end
  ticks: string[];
}

// A scale bar about 1.5 inches long on paper in a round distance, given how many meters one inch
// of the printed map covers
function bar(metersPerInch: number, unitMeters: number, unit: string): ScaleBar {
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const target = (1.5 * metersPerInch) / unitMeters;
  const length = [...steps].reverse().find((s) => s <= target) ?? steps[0];
  return {
    label: unit,
    inches: (length * unitMeters) / metersPerInch,
    ticks: ["0", String(length / 2), String(length)],
  };
}

export function scaleBars(metersPerInch: number): { ratio: number; miles: ScaleBar } {
  return {
    ratio: Math.round(metersPerInch / 0.0254),
    miles: bar(metersPerInch, 1609.344, "mi"),
  };
}

// Great-circle distance in meters between two longitude/latitude points
export function distanceMeters(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}
