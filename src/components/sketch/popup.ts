// A sketch's popup (map-sketches), ported from StewardshipOS: what the sketch is, and Edit sketch,
// which opens the Sketch panel with it selected. Given to each sketch as it's added to the
// layer; not saved with it.
import type Graphic from "@arcgis/core/Graphic.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import ActionButton from "@arcgis/core/support/actions/ActionButton.js";
import type { SketchColor } from "./palette.ts";
import { describeSketch } from "./symbols.ts";

/** The popup action's id, handled by the Sketch panel on the map element (design D7). */
export const EDIT_SKETCH_ACTION_ID = "viewer-edit-sketch";

/** The popup template for sketches, describing colors by the names in `colors`. */
export function sketchPopupTemplate(colors: () => readonly SketchColor[]): PopupTemplate {
  return new PopupTemplate({
    title: (event: { graphic: Graphic }) => describeSketch(event.graphic, colors()).title,
    actions: [new ActionButton({ id: EDIT_SKETCH_ACTION_ID, title: "Edit sketch", icon: "pencil" })],
    content: (event: { graphic: Graphic }) => {
      const el = document.createElement("div");
      const what = document.createElement("p");
      what.style.margin = "0 0 0.5em";
      what.textContent = describeSketch(event.graphic, colors()).text;
      const how = document.createElement("p");
      how.style.margin = "0";
      how.style.color = "var(--calcite-color-text-3)";
      how.textContent = "One of your sketches. Edit sketch selects it in the Sketch panel, to change or delete it.";
      el.append(what, how);
      return el;
    },
  });
}
