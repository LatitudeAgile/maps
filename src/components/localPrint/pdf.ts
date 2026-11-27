// The PDF page, drawn in the browser with pdf-lib (3d-print D4), and its GeoPDF record (D7).
// Loaded only by `await import("./pdf.ts")` from the export flow, so pdf-lib downloads with the
// first PDF and never for a map image. The only module that imports pdf-lib.
//
// The layout is StewardshipOS's MapPrint.vue: the title centered above the map; below the map
// the date and the legend on the left, the scale and the credits on the right. The GEO measure
// dictionary is StewardshipOS electron/main/geopdf.ts's, written over the image box this code
// drew, so its content-stream parser and Node Buffer aren't needed.
import { PDFDocument, PDFName, PDFString, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { GeoCorners, Placement } from "./capture.ts";
import type { FittedLegend, LegendRow } from "./legend.ts";
import { MAP_PAGE_MARGINS, mapPage, pageSize, scaleBars, TITLE_HEIGHT } from "./page.ts";

export interface PdfInput {
  /** Empty: no title line. */
  title: string;
  landscape: boolean;
  /** The map picture, a JPEG data URL. */
  image: string;
  date: string;
  legend: FittedLegend;
  credits: string;
  /** Null when the print isn't to scale (a tilted scene): "Not to scale", no GeoPDF. */
  placement: Placement | null;
}

const PT = 72; // points per inch
const TEXT = rgb(0.133, 0.133, 0.133); // #222
const MUTED = rgb(0.267, 0.267, 0.267); // #444
const FRAME = rgb(0.2, 0.2, 0.2); // #333
const FONT_STACK = "Helvetica, Arial, sans-serif";
/** Text drawn as an image is rendered at 300 DPI. */
const TEXT_IMAGE_SCALE = 300 / PT;

const LEGEND_ROWS = { landscape: 3, portrait: 4 };
const ROW_PITCH = 13;
const SWATCH_BOX = { width: 18, height: 12 };
const INDENT = 8;
const COLUMN_GAP = 12;

/** Writes text in Helvetica; a line it can't encode (WinAnsi) is drawn as a 300 DPI image (D4). */
class TextWriter {
  readonly #doc: PDFDocument;
  readonly #page: PDFPage;
  readonly #font: PDFFont;
  readonly #measure = document.createElement("canvas").getContext("2d")!;

  constructor(doc: PDFDocument, page: PDFPage, font: PDFFont) {
    this.#doc = doc;
    this.#page = page;
    this.#font = font;
  }

  #encodable(text: string): boolean {
    try {
      this.#font.encodeText(text);
      return true;
    } catch {
      return false;
    }
  }

  width(text: string, size: number): number {
    if (this.#encodable(text)) return this.#font.widthOfTextAtSize(text, size);
    this.#measure.font = `${size}px ${FONT_STACK}`;
    return this.#measure.measureText(text).width;
  }

  /** The text, cut with "…" to fit `maxWidth`. */
  fit(text: string, size: number, maxWidth: number): string {
    if (this.width(text, size) <= maxWidth) return text;
    let cut = text;
    while (cut.length > 0 && this.width(`${cut}…`, size) > maxWidth) cut = cut.slice(0, -1);
    return cut ? `${cut.trimEnd()}…` : "";
  }

  /** The text in lines of at most `maxWidth`, broken at spaces. */
  wrap(text: string, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && this.width(next, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines.map((l) => this.fit(l, size, maxWidth));
  }

  /** Draw one line with its baseline `baseline` points from the page's top. */
  async draw(text: string, x: number, baseline: number, size: number, color: RGB): Promise<void> {
    if (!text) return;
    const pageHeight = this.#page.getHeight();
    if (this.#encodable(text)) {
      this.#page.drawText(text, { x, y: pageHeight - baseline, size, font: this.#font, color });
      return;
    }
    const s = TEXT_IMAGE_SCALE;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${size * s}px ${FONT_STACK}`;
    canvas.width = Math.ceil(ctx.measureText(text).width) + 2;
    canvas.height = Math.ceil(size * 1.4 * s);
    ctx.font = `${size * s}px ${FONT_STACK}`; // resizing the canvas resets it
    ctx.fillStyle = `rgb(${color.red * 255} ${color.green * 255} ${color.blue * 255})`;
    ctx.fillText(text, 0, size * 1.1 * s);
    const image = await this.#doc.embedPng(canvas.toDataURL("image/png"));
    this.#page.drawImage(image, {
      x,
      y: pageHeight - (baseline + size * 0.3),
      width: canvas.width / s,
      height: canvas.height / s,
    });
  }
}

/** Make the PDF: one Letter page in the chosen orientation. */
export async function makePdf(input: PdfInput): Promise<Uint8Array> {
  const layout = mapPage(input.landscape);
  const size = pageSize(input.landscape);
  const doc = await PDFDocument.create();
  doc.setTitle(input.title || "Map");
  doc.setCreator("ArcGIS sidebar viewer");
  const page = doc.addPage([size.width * PT, size.height * PT]);
  const pageHeight = page.getHeight();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const text = new TextWriter(doc, page, font);

  const contentLeft = MAP_PAGE_MARGINS.left * PT;
  const contentWidth = (size.width - MAP_PAGE_MARGINS.left - MAP_PAGE_MARGINS.right) * PT;
  const contentBottom = (size.height - MAP_PAGE_MARGINS.bottom) * PT; // from the top
  const top = MAP_PAGE_MARGINS.top * PT;

  // Title: 17 pt, centered over the page in its 0.4 in line, 0.1 in above the map
  if (input.title) {
    const titleSize = 17;
    const line = text.fit(input.title, titleSize, contentWidth);
    const baseline = top + 0.2 * PT + titleSize * 0.36;
    await text.draw(line, contentLeft + (contentWidth - text.width(line, titleSize)) / 2, baseline, titleSize, TEXT);
  }

  // The map, centered, with a thin frame drawn over the image's edge
  const map = {
    x: contentLeft + (contentWidth - layout.mapWidth * PT) / 2,
    top: top + TITLE_HEIGHT * PT,
    width: layout.mapWidth * PT,
    height: layout.mapHeight * PT,
  };
  const picture = await doc.embedJpg(input.image);
  const imageBox = { x: map.x, y: pageHeight - map.top - map.height, width: map.width, height: map.height };
  page.drawImage(picture, imageBox);
  page.drawRectangle({ ...imageBox, borderColor: FRAME, borderWidth: 0.75 });

  // Under the map: left two thirds the date and legend, right third the scale and credits
  const under = map.top + map.height + 5;
  const rightWidth = map.width / 3;
  const leftWidth = map.width - rightWidth - 18;
  const rightX = map.x + map.width - rightWidth;

  await text.draw(text.fit(input.date, 8, leftWidth), map.x, under + 8, 8, TEXT);
  await drawLegend(page, doc, text, input.legend, {
    x: map.x,
    top: under + 15,
    width: leftWidth,
    columns: layout.legendColumns,
    rows: LEGEND_ROWS[input.landscape ? "landscape" : "portrait"],
  });

  let creditsTop: number;
  if (input.placement) {
    const scale = scaleBars(input.placement.metersPerInch);
    const ratio = `1:${scale.ratio.toLocaleString()}`;
    await text.draw(ratio, rightX + (rightWidth - text.width(ratio, 8)) / 2, under + 8, 8, TEXT);
    // The bar, its ticks' labels above it and its unit after it, centered in the column
    const barWidth = scale.miles.inches * PT;
    const unitWidth = text.width(scale.miles.label, 7);
    const barX = rightX + (rightWidth - barWidth - 4 - unitWidth) / 2;
    const barTop = under + 20;
    scale.miles.ticks.forEach((tick, i) => {
      const at = barX + (barWidth * i) / (scale.miles.ticks.length - 1);
      page.drawText(tick, { x: at - font.widthOfTextAtSize(tick, 7) / 2, y: pageHeight - (barTop - 2), size: 7, font, color: TEXT });
    });
    const barBottom = pageHeight - (barTop + 3);
    const line = { thickness: 0.75, color: TEXT };
    page.drawLine({ start: { x: barX, y: barBottom }, end: { x: barX + barWidth, y: barBottom }, ...line });
    page.drawLine({ start: { x: barX, y: barBottom }, end: { x: barX, y: pageHeight - barTop }, ...line });
    page.drawLine({ start: { x: barX + barWidth, y: barBottom }, end: { x: barX + barWidth, y: pageHeight - barTop }, ...line });
    page.drawText(scale.miles.label, { x: barX + barWidth + 4, y: barBottom, size: 7, font, color: TEXT });
    creditsTop = barTop + 12;
  } else {
    const notToScale = "Not to scale";
    await text.draw(notToScale, rightX + (rightWidth - text.width(notToScale, 8)) / 2, under + 8, 8, TEXT);
    creditsTop = under + 16;
  }

  // Credits: 6.5 pt, right-aligned, wrapped to the column; lines past the page's margin are left out
  const creditSize = 6.5;
  let baseline = creditsTop + creditSize;
  for (const line of text.wrap(input.credits, creditSize, rightWidth)) {
    if (baseline > contentBottom) break;
    await text.draw(line, rightX + rightWidth - text.width(line, creditSize), baseline, creditSize, MUTED);
    baseline += creditSize * 1.25;
  }

  if (input.placement) addGeoViewport(doc, page, imageBox, input.placement);
  return doc.save();
}

/** The legend's grid, filled down each column, then across; nothing is drawn outside it. */
async function drawLegend(
  page: PDFPage,
  doc: PDFDocument,
  text: TextWriter,
  legend: FittedLegend,
  area: { x: number; top: number; width: number; columns: number; rows: number },
): Promise<void> {
  const pageHeight = page.getHeight();
  const columnWidth = (area.width - COLUMN_GAP * (area.columns - 1)) / area.columns;
  const cells: (LegendRow | string)[] = [...legend.rows, ...(legend.more > 0 ? [`and ${legend.more} more`] : [])];
  for (const [index, cell] of cells.entries()) {
    const column = Math.floor(index / area.rows);
    if (column >= area.columns) break;
    const x = area.x + column * (columnWidth + COLUMN_GAP);
    const rowTop = area.top + (index % area.rows) * ROW_PITCH;
    const baseline = rowTop + SWATCH_BOX.height / 2 + 8 * 0.36;
    if (typeof cell === "string") {
      await text.draw(text.fit(cell, 8, columnWidth), x, baseline, 8, MUTED);
      continue;
    }
    let labelX = x + (cell.indent ? INDENT : 0);
    if (cell.swatch) {
      // At its own size, scaled down to fit the swatch box, centered in it
      const fit = Math.min(1, SWATCH_BOX.width / cell.swatch.width, SWATCH_BOX.height / cell.swatch.height);
      const width = cell.swatch.width * fit;
      const height = cell.swatch.height * fit;
      const image = await doc.embedPng(cell.swatch.dataUrl);
      page.drawImage(image, {
        x: labelX + (SWATCH_BOX.width - width) / 2,
        y: pageHeight - (rowTop + (SWATCH_BOX.height + height) / 2),
        width,
        height,
      });
      labelX += SWATCH_BOX.width + 4;
    }
    await text.draw(text.fit(cell.label, 8, x + columnWidth - labelX), labelX, baseline, 8, TEXT);
  }
}

// Esri's sphere-based Web Mercator WKT, as Esri's print service writes it; Acrobat reads it, and
// ignored the newer "Mercator_Auxiliary_Sphere" WKT with EPSG 3857 (StewardshipOS geopdf.ts).
const WEB_MERCATOR_WKT =
  'PROJCS["WGS_1984_Web_Mercator",GEOGCS["GCS_WGS_1984_Major_AuxSphere",DATUM["D_WGS_1984_Major_AuxSphere",' +
  'SPHEROID["WGS_1984",6378137.0,0.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],' +
  'PROJECTION["Mercator"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],' +
  'PARAMETER["Central_Meridian",0.0],PARAMETER["Standard_Parallel_1",0.0],UNIT["Meter",1.0]]';
const WGS84_WKT =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
  'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

/** The GEO dictionary's coordinate system (D7), or null to leave the dictionary out. */
function coordinateSystem(sr: Placement["spatialReference"]): { type: "PROJCS" | "GEOGCS"; wkt: string } | null {
  if (sr.isWebMercator) return { type: "PROJCS", wkt: WEB_MERCATOR_WKT };
  if (sr.isWGS84) return { type: "GEOGCS", wkt: WGS84_WKT };
  if (sr.wkt?.startsWith("PROJCS")) return { type: "PROJCS", wkt: sr.wkt };
  if (sr.wkt?.startsWith("GEOGCS")) return { type: "GEOGCS", wkt: sr.wkt };
  return null;
}

/**
 * The page's geospatial viewport over the map image (the ISO 32000 / Adobe "GEO" measure
 * dictionary), so map apps such as Avenza Maps and Acrobat know where each point of the map is.
 */
function addGeoViewport(doc: PDFDocument, page: PDFPage, box: { x: number; y: number; width: number; height: number }, placement: Placement): void {
  const gcs = coordinateSystem(placement.spatialReference);
  if (!gcs) return;
  const corners: GeoCorners = placement.corners;
  const ctx = doc.context;
  // Unit-square points within the viewport (0,0 bottom left), in Esri's order (bottom left, top
  // left, top right, bottom right), and the latitude/longitude of each; Bounds is the same
  // outline, closed
  const lpts = [0, 0, 0, 1, 1, 1, 1, 0];
  const gpts = [corners.bottomLeft, corners.topLeft, corners.topRight, corners.bottomRight].flatMap((c) => [c.latitude, c.longitude]);
  const measure = ctx.obj({
    Type: "Measure",
    Subtype: "GEO",
    Bounds: [...lpts, 0, 0],
    GPTS: gpts,
    LPTS: lpts,
    GCS: ctx.obj({ Type: gcs.type, WKT: PDFString.of(gcs.wkt) }),
  });
  const viewport = ctx.obj({
    Type: "Viewport",
    BBox: [box.x, box.y, box.x + box.width, box.y + box.height],
    Name: PDFString.of("Map"),
    Measure: measure,
  });
  page.node.set(PDFName.of("VP"), ctx.obj([viewport]));
}
