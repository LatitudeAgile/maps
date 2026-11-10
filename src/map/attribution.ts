/**
 * The map's attribution line runs the full width of the map, under the floating sidebar's
 * bottom edge rather than beside it, and the sidebar stops above it (style.css).
 *
 * arcgis-map gives the attribution a left margin from `--arcgis-layout-overlay-space-left`, the
 * same property that keeps its corner UI and popups clear of the sidebar (src/sidebar/insets.ts).
 * The attribution sits in the map's shadow root and has no part or property of its own, so a
 * small stylesheet adopted there, after the map's own, removes that margin on the attribution
 * alone. The rest of the map UI keeps the inset.
 */
const FULL_WIDTH = ".esri-attribution { margin-left: 0; }";

/**
 * Make the attribution full width and keep `--attribution-height` on `root` equal to its height,
 * re-measured when it changes (a click expands it to every source; text sizes change with the
 * map's width). Call once the view is ready, when the attribution exists. Returns a function that
 * stops tracking.
 */
export function trackAttribution(mapElement: HTMLElement, root: HTMLElement): () => void {
  const shadow = mapElement.shadowRoot;
  const attribution = shadow?.querySelector<HTMLElement>(".esri-attribution");
  if (!shadow || !attribution) return () => undefined;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(FULL_WIDTH);
  shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];

  let last = "";
  const measure = () => {
    const value = `${Math.round(attribution.getBoundingClientRect().height)}px`;
    if (value === last) return;
    last = value;
    root.style.setProperty("--attribution-height", value);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(attribution);
  measure();
  return () => {
    observer.disconnect();
    shadow.adoptedStyleSheets = shadow.adoptedStyleSheets.filter((s) => s !== sheet);
    root.style.removeProperty("--attribution-height");
  };
}
