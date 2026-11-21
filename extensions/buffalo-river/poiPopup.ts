// The popup for a point of interest: its name, type and side of the river, then its description,
// one paragraph at a time, and the source's credit when the data names one. Ported from
// brokan.xyz/buffalo (PointOfInterestDiv.tsx).
import type Graphic from "@arcgis/core/Graphic.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import { pointsOfInterest, type PoiType, type PointOfInterest } from "./data/pointsOfInterest.ts";

const TYPE_NAMES: Record<PoiType, string> = {
  stream: "Stream",
  bluff: "Bluff",
  hollow: "Hollow",
  trail: "Trail",
  bridge: "Bridge",
  other: "Point of interest",
};

const SOURCE_CREDITS: Record<NonNullable<PointOfInterest["source"]>, string> = {
  "ozark society": "Source: The Buffalo River Handbook, Ozark Society",
};

/** Descriptions are written as indented multi-line text: blank lines separate paragraphs. */
export const paragraphsOf = (description: string): string[] =>
  description
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);

/** "Bluff · River left", or just the type when the side isn't known. */
export const describePlace = (poi: PointOfInterest): string =>
  [TYPE_NAMES[poi.type] ?? TYPE_NAMES.other, poi.side ? `River ${poi.side}` : null].filter(Boolean).join(" · ");

function content({ graphic }: { graphic: Graphic }): HTMLElement {
  const poi = pointsOfInterest[graphic.attributes.Index as number];
  const root = document.createElement("div");
  if (!poi) return root;
  const place = document.createElement("p");
  place.style.cssText = "margin: 0 0 0.75em; color: var(--calcite-color-text-3);";
  place.textContent = describePlace(poi);
  root.append(place);
  const paragraphs = paragraphsOf(poi.description ?? "");
  if (paragraphs.length === 0) {
    const none = document.createElement("p");
    none.style.cssText = "margin: 0; font-style: italic; color: var(--calcite-color-text-3);";
    none.textContent = "No description available.";
    root.append(none);
  }
  for (const text of paragraphs) {
    const paragraph = document.createElement("p");
    paragraph.style.cssText = "margin: 0 0 0.75em;";
    paragraph.textContent = text;
    root.append(paragraph);
  }
  const credit = poi.source ? SOURCE_CREDITS[poi.source] : undefined;
  if (credit) {
    const source = document.createElement("p");
    source.style.cssText = "margin: 0; font-size: var(--calcite-font-size--1); color: var(--calcite-color-text-3);";
    source.textContent = credit;
    root.append(source);
  }
  return root;
}

export const poiPopupTemplate = (): PopupTemplate =>
  new PopupTemplate({ title: "{Name}", outFields: ["Index", "Name"], content });
