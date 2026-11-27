// A spot's coordinates as text for Copy coordinates (map-menu; add-map-menu D7). Decimal degrees
// come from the context's latitude and longitude, with no WebAssembly. The other formats load
// the SDK's coordinate formatter the first time one is used.
import type { MenuCoordinateFormat } from "../../config/mapMenu.ts";
import type { MapMenuContext } from "./registry.ts";

/** The spot in `format`; throws when the formatter can't load or gives nothing. */
export async function formatCoordinates(context: MapMenuContext, format: MenuCoordinateFormat): Promise<string> {
  if (format === "dd") return `${context.latitude.toFixed(6)}, ${context.longitude.toFixed(6)}`;
  const [formatter, { default: Point }] = await Promise.all([
    import("@arcgis/core/geometry/coordinateFormatter.js"),
    import("@arcgis/core/geometry/Point.js"),
  ]);
  if (!formatter.isLoaded()) await formatter.load();
  // The formatter takes a point in a geographic coordinate system.
  const point = new Point({ latitude: context.latitude, longitude: context.longitude, spatialReference: { wkid: 4326 } });
  const text =
    format === "mgrs"
      ? formatter.toMgrs(point, "automatic", 5, true)
      : format === "usng"
        ? formatter.toUsng(point, 5, true)
        : format === "utm"
          ? formatter.toUtm(point, "latitude-band-indicators", true)
          : formatter.toLatitudeLongitude(point, format, format === "dms" ? 1 : 4);
  if (!text) throw new Error(`The coordinate formatter gave no ${format} text for this spot.`);
  return text;
}
