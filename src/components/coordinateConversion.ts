// The coordinate-conversion type's formats (map-components; add-map-expand-and-components
// D7). Conversion runs in the browser through the SDK's coordinate formatter: no service.
import type Collection from "@arcgis/core/core/Collection.js";
import type { ConfigurableElement } from "./registry.ts";

/** The SDK 5.2 component's format names, the default set it offers. */
export const COORDINATE_FORMATS = ["xy", "dd", "ddm", "dms", "mgrs", "usng", "utm", "basemap"] as const;
export const COORDINATE_MODES = ["live", "capture"] as const;

type FormatsElement = ConfigurableElement & {
  formats: Collection<{ name: string | null | undefined }>;
  componentOnReady(): Promise<unknown>;
};

/**
 * Set the mode, and offer only the configured formats. The component creates its formats when
 * the element is created, so they are trimmed here, before it is attached: trimming after it
 * starts re-renders its conversion list, and in SDK 5.2 a render before its messages have loaded
 * throws. The SDK does the rest: restoring stored state adds a conversion only in an offered
 * format, and with none left it adds a default one (`xy` if offered, else the first format).
 */
export function configureCoordinateConversion(element: ConfigurableElement, options: Readonly<Record<string, unknown>>): void {
  element.mode = options.mode;
  const formats = options.formats as readonly string[] | undefined;
  if (!formats) return;
  const el = element as FormatsElement;
  const trim = () => el.formats.removeMany(el.formats.filter((f) => !formats.includes(f.name ?? "")));
  if (el.formats) trim();
  else void el.componentOnReady().then(trim, () => undefined);
}
