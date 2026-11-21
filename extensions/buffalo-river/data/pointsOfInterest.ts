// Points of interest along the Buffalo River: one data set per type, in pointsOfInterest/, each
// shown as its own layer. From brokan.xyz/buffalo, used with permission.
import { bluffs } from "./pointsOfInterest/bluffs.ts";
import { bridges } from "./pointsOfInterest/bridges.ts";
import { hollows } from "./pointsOfInterest/hollows.ts";
import { otherPlaces } from "./pointsOfInterest/otherPlaces.ts";
import { streams } from "./pointsOfInterest/streams.ts";
import { trails } from "./pointsOfInterest/trails.ts";

export type PoiType = "stream" | "bluff" | "hollow" | "trail" | "bridge" | "other";

/** A named place along the river, in a data set of one type. side is the bank, facing downstream. */
export interface Place {
  name: string;
  description?: string;
  /** Where the description comes from, credited under it in the popup. No point uses it yet. */
  source?: "ozark society";
  side?: "left" | "right";
  coord: {
    longitude: number;
    latitude: number;
  };
}

export interface PointOfInterest extends Place {
  type: PoiType;
}

/** The types in layer order, each with its layer's title and its data set. */
export const POI_TYPES: readonly { type: PoiType; label: string; places: readonly Place[] }[] = [
  { type: "stream", label: "Streams", places: streams },
  { type: "bluff", label: "Bluffs", places: bluffs },
  { type: "hollow", label: "Hollows", places: hollows },
  { type: "trail", label: "Trails", places: trails },
  { type: "bridge", label: "Bridges", places: bridges },
  { type: "other", label: "Other", places: otherPlaces },
];

/**
 * Every point of interest, type by type. A point's index here identifies it, since names repeat
 * along the river.
 */
export const pointsOfInterest: readonly PointOfInterest[] = POI_TYPES.flatMap(({ type, places }) =>
  places.map((place) => ({ ...place, type })),
);
