// The layers one buffalo-river element adds to its scene: the park boundary, the Upper Buffalo,
// Ponca and Lower Buffalo wilderness areas, the river coloured by level, the access points, the points of interest (a layer per type, and the river gauges), and the
// selected trip's stretch. Each element makes its own, and removes them again with destroy().
// Symbols, labels and colours are ported from brokan.xyz/buffalo (buffaloArcGisHelper.ts). See
// design D2, D3 and D14.
import Graphic from "@arcgis/core/Graphic.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import Point from "@arcgis/core/geometry/Point.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import { unionExecuteMany } from "@arcgis/core/geometry/operators/unionOperator.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import GroupLayer from "@arcgis/core/layers/GroupLayer.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import LabelClass from "@arcgis/core/layers/support/LabelClass.js";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import { executeQueryJSON } from "@arcgis/core/rest/query.js";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import ColorVariable from "@arcgis/core/renderers/visualVariables/ColorVariable.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol.js";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import type FeatureLayerView from "@arcgis/core/views/layers/FeatureLayerView.js";
import { accessPoints } from "./data/accessPoints.ts";
import { POI_TYPES, pointsOfInterest, type PoiType } from "./data/pointsOfInterest.ts";
import { riverPath } from "./data/riverPath.ts";
import { LEVEL_BANDS } from "./levels.ts";
import { poiPopupTemplate } from "./poiPopup.ts";

/** Layer ids, prefixed so they can't collide with a layer from the app's config. */
export const LAYER_IDS = {
  river: "buffalo-river-levels",
  access: "buffalo-river-access",
  /** The group; each type's layer is `buffalo-river-poi-<type>`. */
  poi: "buffalo-river-poi",
  gauges: "buffalo-river-gauges",
  park: "buffalo-river-park",
  upperWilderness: "buffalo-river-wilderness-upper",
  poncaWilderness: "buffalo-river-wilderness-ponca",
  lowerWilderness: "buffalo-river-wilderness-lower",
  selection: "buffalo-river-selection",
} as const;

/** Live stream gauges, as published in ArcGIS Living Atlas. Public: no key needed. */
const GAUGES_URL =
  "https://rhvpkkiftonktxq3.svcs9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/Live_Stream_Gauges_v1/FeatureServer/0";
/** The USGS gauges on this river: not its tributaries, the White River, or other states' Buffalo Rivers. */
const GAUGES_WHERE = "org = 'USGS' AND name LIKE 'Buffalo River%, AR'";
/** The National Park Service's unit boundaries. Public: no key needed. */
const PARK_URL =
  "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2";
const PARK_WHERE = "UNIT_CODE = 'BUFF'";
/** The National Wilderness Preservation System, from Wilderness Connect. Public: no key needed. */
const WILDERNESS_URL =
  "https://services1.arcgis.com/ERdCHt0sNM6dENSD/arcgis/rest/services/Wilderness_Areas_in_the_United_States/FeatureServer/0";
/**
 * Upper Buffalo Wilderness (Forest Service, 621) and Buffalo National River Wilderness (Park
 * Service, 85). The service's 85 is one feature with five parts: the Park Service's share of the
 * Upper Buffalo, Ponca, and the Lower Buffalo's four pieces.
 */
const WILDERNESS_WHERE = "WID IN (85, 621)";
/** Parts of feature 85 west of UPPER_WEST_OF join the Upper Buffalo, parts east of LOWER_EAST_OF
 * are the Lower Buffalo, and the part between is Ponca. */
const UPPER_WEST_OF = -93.38;
const LOWER_EAST_OF = -92.8;

export const ACCESS_POINT_COLOR = "#0079c1";
/** Orange reads as a caution beside the blue, and stays distinct for common colour blindness. */
export const PRIMITIVE_ACCESS_POINT_COLOR = "#e65100";
const POINT_OF_INTEREST_COLOR = "#8e24aa";
/** The park's green, drawn faintly so the basemap shows through. */
const PARK_COLOR: [number, number, number] = [56, 142, 60];
/** A darker green than the park's, with a dashed edge, so the wilderness inside the park stands out. */
const WILDERNESS_COLOR: [number, number, number] = [27, 94, 32];
/** The river's colour while no level is known: a grey that isn't one of the five bands. */
const NO_LEVEL_COLOR = "#9e9e9e";
const RIVER_WIDTH = 5;

const icon = (file: string): string => new URL(`./icons/${file}`, import.meta.url).href;
const ACCESS_ICON = icon("access.png");
const PRIMITIVE_ACCESS_ICON = icon("access-primitive.png");
export const POI_ICONS: Record<PoiType, string> = {
  stream: icon("poi-stream.svg"),
  bluff: icon("poi-bluff.svg"),
  hollow: icon("poi-hollow.svg"),
  trail: icon("poi-trail.svg"),
  bridge: icon("poi-bridge.svg"),
  other: icon("poi-other.svg"),
};
const GAUGE_ICON = icon("poi-gauge.svg");

interface VerticalOffset {
  screenLength: number;
  maxWorldLength: number;
  minWorldLength: number;
}

const POI_OFFSET: VerticalOffset = { screenLength: 40, maxWorldLength: 1000, minWorldLength: 35 };
/** Access points sit higher, so near a point of interest their icon and label clear its. */
const ACCESS_OFFSET: VerticalOffset = { screenLength: 100, maxWorldLength: 2500, minWorldLength: 90 };

function pointSymbol(href: string, color: string, verticalOffset: VerticalOffset): PointSymbol3D {
  return new PointSymbol3D({
    symbolLayers: [
      {
        type: "icon",
        resource: { href },
        size: 20,
        outline: { color: "white", size: 2 },
        // Dimmed rather than hidden behind terrain, so a point in a valley stays findable.
        occludedVisibility: { mode: "adaptive" },
      },
    ],
    verticalOffset,
    callout: { type: "line", color: "white", size: 2, border: { color } },
  });
}

function nameLabels(haloColor: string, expression = "$feature.Name"): LabelClass[] {
  return [
    new LabelClass({
      symbol: { type: "text", color: "white", haloColor, haloSize: 1, font: { family: "sans-serif", size: 12 } },
      labelPlacement: "above-center",
      labelExpressionInfo: { expression },
      maxScale: 0,
      minScale: 25000000,
    }),
  ];
}

const NO_LEVEL_RENDERER = new SimpleRenderer({
  label: "Level unavailable",
  symbol: new SimpleLineSymbol({ color: NO_LEVEL_COLOR, width: RIVER_WIDTH }),
});

const LEVEL_RENDERER = new SimpleRenderer({
  symbol: new SimpleLineSymbol({ color: NO_LEVEL_COLOR, width: RIVER_WIDTH }),
  visualVariables: [
    new ColorVariable({
      field: "Level",
      legendOptions: { title: "Estimated level" },
      stops: LEVEL_BANDS.map((band) => ({ value: band.score, color: band.color, label: band.label })),
    }),
  ],
});

function riverLayer(): FeatureLayer {
  // One feature per segment, so each can carry its own level. Segment i joins vertex i and i + 1.
  const source: Graphic[] = [];
  for (let i = 0; i < riverPath.length - 1; i++) {
    source.push(
      new Graphic({
        geometry: new Polyline({ spatialReference: { wkid: 4326 }, paths: [[riverPath[i], riverPath[i + 1]]] }),
        attributes: { ObjectID: i + 1, Segment: i, Level: null },
      }),
    );
  }
  return new FeatureLayer({
    id: LAYER_IDS.river,
    title: "Buffalo River",
    source,
    geometryType: "polyline",
    spatialReference: { wkid: 4326 },
    objectIdField: "ObjectID",
    fields: [
      { name: "ObjectID", type: "oid" },
      { name: "Segment", type: "integer" },
      { name: "Level", alias: "Estimated level", type: "double" },
    ],
    outFields: ["*"],
    renderer: NO_LEVEL_RENDERER,
    popupEnabled: false,
  });
}

function accessLayer(): FeatureLayer {
  return new FeatureLayer({
    id: LAYER_IDS.access,
    title: "Access points",
    source: accessPoints.map(
      (ap, index) =>
        new Graphic({
          geometry: new Point({ longitude: ap.coord.longitude, latitude: ap.coord.latitude }),
          attributes: { ObjectID: index + 1, Name: ap.name, Type: ap.isPrimitive ? "PrimitiveAccess" : "Access" },
        }),
    ),
    geometryType: "point",
    spatialReference: { wkid: 4326 },
    objectIdField: "ObjectID",
    fields: [
      { name: "ObjectID", type: "oid" },
      { name: "Name", type: "string" },
      { name: "Type", type: "string" },
    ],
    outFields: ["*"],
    renderer: new UniqueValueRenderer({
      field: "Type",
      uniqueValueInfos: [
        { value: "Access", label: "Access point", symbol: pointSymbol(ACCESS_ICON, ACCESS_POINT_COLOR, ACCESS_OFFSET) },
        {
          value: "PrimitiveAccess",
          label: "Primitive access",
          symbol: pointSymbol(PRIMITIVE_ACCESS_ICON, PRIMITIVE_ACCESS_POINT_COLOR, ACCESS_OFFSET),
        },
      ],
    }),
    labelingInfo: nameLabels(ACCESS_POINT_COLOR),
    // Clicks on access points pick a trip (design D6), so they open no popup.
    popupEnabled: false,
  });
}

/** One type's points of interest, from its data set. */
function poiLayer(type: PoiType, label: string): FeatureLayer {
  // Names repeat along the river, so a point is identified by its index in pointsOfInterest, kept
  // in its own field: ObjectID belongs to the layer.
  const source = pointsOfInterest.flatMap((poi, index) =>
    poi.type === type
      ? [
          new Graphic({
            geometry: new Point({ longitude: poi.coord.longitude, latitude: poi.coord.latitude }),
            attributes: { ObjectID: index + 1, Index: index, Name: poi.name },
          }),
        ]
      : [],
  );
  return new FeatureLayer({
    id: `${LAYER_IDS.poi}-${type}`,
    title: label,
    source,
    geometryType: "point",
    spatialReference: { wkid: 4326 },
    objectIdField: "ObjectID",
    fields: [
      { name: "ObjectID", type: "oid" },
      { name: "Index", type: "integer" },
      { name: "Name", type: "string" },
    ],
    outFields: ["*"],
    // Off at first, like the gauges and the park boundary: the app opens on the river and its
    // access points. The layer list turns each kind on.
    visible: false,
    renderer: new SimpleRenderer({ label, symbol: pointSymbol(POI_ICONS[type], POINT_OF_INTEREST_COLOR, POI_OFFSET) }),
    labelingInfo: nameLabels(POINT_OF_INTEREST_COLOR),
    popupTemplate: poiPopupTemplate(),
  });
}

/** "Buffalo River near Boxley, AR" is labelled "Boxley gauge". */
const GAUGE_LABEL = `
var place = Replace(Replace(Replace($feature.name, "Buffalo River ", ""), ", AR", ""), " nr ", " near ");
if (Left(place, 5) == "near ") { place = Mid(place, 5); }
if (Left(place, 3) == "at ") { place = Mid(place, 3); }
return place + " gauge";`;

/** The river's live gauges, from the Living Atlas service. */
function gaugeLayer(): FeatureLayer {
  return new FeatureLayer({
    id: LAYER_IDS.gauges,
    title: "River gauges",
    url: GAUGES_URL,
    definitionExpression: GAUGES_WHERE,
    outFields: ["name", "flow_cfs", "stage_ft", "lastupdate", "stationurl"],
    renderer: new SimpleRenderer({
      label: "USGS gauge",
      symbol: pointSymbol(GAUGE_ICON, POINT_OF_INTEREST_COLOR, POI_OFFSET),
    }),
    labelingInfo: nameLabels(POINT_OF_INTEREST_COLOR, GAUGE_LABEL),
    visible: false,
    popupTemplate: new PopupTemplate({
      title: "{name}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "flow_cfs", label: "Flow (cubic feet per second)", format: { digitSeparator: true, places: 1 } },
            { fieldName: "stage_ft", label: "Height (feet)", format: { digitSeparator: true, places: 2 } },
            { fieldName: "lastupdate", label: "Last reading", format: { dateFormat: "short-date-short-time" } },
          ],
        },
        { type: "text", text: '<a href="{stationurl}" target="_blank" rel="noopener">Station page at USGS</a>' },
      ],
    }),
  });
}

/** Buffalo National River's boundary, from the National Park Service. */
function parkLayer(): FeatureLayer {
  return new FeatureLayer({
    id: LAYER_IDS.park,
    title: "Buffalo National River boundary",
    url: PARK_URL,
    definitionExpression: PARK_WHERE,
    outFields: ["UNIT_NAME"],
    renderer: new SimpleRenderer({
      label: "Buffalo National River",
      symbol: new SimpleFillSymbol({
        color: [...PARK_COLOR, 0.12],
        outline: new SimpleLineSymbol({ color: [...PARK_COLOR, 0.9], width: 1.5 }),
      }),
    }),
    // A click inside the park is a click on the map, not on the park.
    popupEnabled: false,
    visible: false,
  });
}

/** An empty layer for one wilderness area; RiverLayers fills it from the service. */
function wildernessLayer(id: string, title: string): FeatureLayer {
  return new FeatureLayer({
    id,
    title,
    source: [],
    geometryType: "polygon",
    spatialReference: { wkid: 4326 },
    objectIdField: "ObjectID",
    fields: [
      { name: "ObjectID", type: "oid" },
      { name: "Name", type: "string" },
    ],
    outFields: ["*"],
    copyright: "Wilderness Connect",
    renderer: new SimpleRenderer({
      label: "Wilderness",
      symbol: new SimpleFillSymbol({
        color: [...WILDERNESS_COLOR, 0.22],
        outline: new SimpleLineSymbol({ color: [...WILDERNESS_COLOR, 0.9], width: 1.5, style: "dash" }),
      }),
    }),
    // Like the park boundary: a click inside it is a click on the map.
    popupEnabled: false,
    visible: false,
  });
}

/** The longitude a ring is centred on. */
function ringLongitude(ring: number[][]): number {
  return ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
}

/**
 * Reads the two wilderness features and splits them into the Upper Buffalo (the Forest Service's
 * area joined to the Park Service's next to it), Ponca and the Lower Buffalo.
 */
async function fetchWilderness(): Promise<{ upper: Polygon | null; ponca: Polygon | null; lower: Polygon | null }> {
  const { features } = await executeQueryJSON(WILDERNESS_URL, {
    where: WILDERNESS_WHERE,
    outFields: ["WID"],
    returnGeometry: true,
    outSpatialReference: { wkid: 4326 },
  });
  const spatialReference = { wkid: 4326 };
  const upperParts: Polygon[] = [];
  const poncaRings: number[][][] = [];
  const lowerRings: number[][][] = [];
  for (const feature of features) {
    const rings = (feature.geometry as Polygon | null)?.rings ?? [];
    if (feature.attributes.WID === 621) {
      upperParts.push(new Polygon({ spatialReference, rings }));
      continue;
    }
    for (const ring of rings) {
      const longitude = ringLongitude(ring);
      if (longitude < UPPER_WEST_OF) upperParts.push(new Polygon({ spatialReference, rings: [ring] }));
      else if (longitude > LOWER_EAST_OF) lowerRings.push(ring);
      else poncaRings.push(ring);
    }
  }
  // Joined, the two agencies' parts of the Upper Buffalo have one outline, with no line between them.
  const upper = upperParts.length > 0 ? (unionExecuteMany(upperParts) as Polygon | null) : null;
  const area = (rings: number[][][]) => (rings.length > 0 ? new Polygon({ spatialReference, rings }) : null);
  return { upper, ponca: area(poncaRings), lower: area(lowerRings) };
}

const STRETCH_OUTLINE = new SimpleLineSymbol({ color: [0, 75, 75, 0.75], width: 12.5, cap: "round" });
const STRETCH_DASH = new SimpleLineSymbol({ color: [0, 255, 255, 0.75], width: 12.5, cap: "round", style: "short-dash" });

/** The layers of one element, and what it does to them. */
export class RiverLayers {
  readonly park = parkLayer();
  readonly upperWilderness = wildernessLayer(LAYER_IDS.upperWilderness, "Upper Buffalo Wilderness");
  readonly poncaWilderness = wildernessLayer(LAYER_IDS.poncaWilderness, "Ponca Wilderness");
  readonly lowerWilderness = wildernessLayer(LAYER_IDS.lowerWilderness, "Lower Buffalo Wilderness");
  readonly river = riverLayer();
  readonly access = accessLayer();
  readonly gauges = gaugeLayer();
  readonly poiTypes = POI_TYPES.map(({ type, label }) => poiLayer(type, label));
  readonly poi = new GroupLayer({
    id: LAYER_IDS.poi,
    title: "Points of interest",
    visibilityMode: "independent",
    // A group lists its last layer first: the gauges, then the types in order.
    layers: [...this.poiTypes].reverse().concat(this.gauges),
  });
  readonly selection = new GraphicsLayer({ id: LAYER_IDS.selection, listMode: "hide" });
  #view: SceneView;
  #accessHighlight: ResourceHandle | undefined;
  #accessRequest = 0;
  #destroyed = false;

  constructor(view: SceneView) {
    this.#view = view;
    view.map?.addMany(this.#ownLayers());
    void this.#loadWilderness();
  }

  /** Fills the wilderness layers. If the service can't be read, they stay empty. */
  async #loadWilderness(): Promise<void> {
    let areas;
    try {
      areas = await fetchWilderness();
    } catch (error) {
      if (!this.#destroyed) console.warn("Buffalo River: the wilderness areas could not be loaded.", error);
      return;
    }
    if (this.#destroyed) return;
    const fill = (layer: FeatureLayer, geometry: Polygon | null, name: string) =>
      geometry ? layer.applyEdits({ addFeatures: [new Graphic({ geometry, attributes: { Name: name } })] }) : undefined;
    await Promise.all([
      fill(this.upperWilderness, areas.upper, "Upper Buffalo Wilderness"),
      fill(this.poncaWilderness, areas.ponca, "Ponca Wilderness"),
      fill(this.lowerWilderness, areas.lower, "Lower Buffalo Wilderness"),
    ]);
  }

  /**
   * The layers this adds to the map, bottom first. Buffalo's order puts the selection under the
   * river, so the wider dashes frame the level colours, and the park and its wilderness areas go
   * under both.
   */
  #ownLayers() {
    return [this.park, this.upperWilderness, this.poncaWilderness, this.lowerWilderness, this.selection, this.river, this.poi, this.access];
  }

  /**
   * Colours the river by `scores`, one per segment, or draws it in the no-level grey when `scores`
   * is null.
   */
  async setLevels(scores: readonly number[] | null): Promise<void> {
    if (this.#destroyed) return;
    if (scores === null) {
      this.river.renderer = NO_LEVEL_RENDERER;
      return;
    }
    const { features } = await this.river.queryFeatures({ where: "1=1", outFields: ["ObjectID", "Segment"], returnGeometry: false });
    if (this.#destroyed) return;
    for (const feature of features) feature.attributes.Level = scores[feature.attributes.Segment as number] ?? null;
    await this.river.applyEdits({ updateFeatures: features });
    if (this.#destroyed) return;
    if (this.river.renderer !== LEVEL_RENDERER) this.river.renderer = LEVEL_RENDERER;
  }

  /** Highlights the named access points, replacing any earlier highlight. */
  async highlightAccessPoints(names: readonly string[]): Promise<void> {
    const request = ++this.#accessRequest;
    this.#accessHighlight?.remove();
    this.#accessHighlight = undefined;
    const ids = accessPoints.flatMap((ap, index) => (names.includes(ap.name) ? [index + 1] : []));
    if (ids.length === 0 || this.#destroyed) return;
    const layerView = (await this.#view.whenLayerView(this.access)) as FeatureLayerView;
    // A later call, or destroy(), happened while waiting: it owns the highlight now.
    if (request !== this.#accessRequest || this.#destroyed) return;
    this.#accessHighlight = layerView.highlight(ids);
  }

  /** Draws the trip's stretch, or clears it. */
  setStretch(stretch: Polyline | null): void {
    this.selection.removeAll();
    if (stretch) {
      this.selection.addMany([
        new Graphic({ geometry: stretch, symbol: STRETCH_OUTLINE }),
        new Graphic({ geometry: stretch, symbol: STRETCH_DASH }),
      ]);
    }
  }

  /** Removes the layers and highlights from the scene. Calls after this do nothing. */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#accessHighlight?.remove();
    this.#view.map?.removeMany(this.#ownLayers());
    for (const layer of [...this.poiTypes, this.gauges, ...this.#ownLayers()]) layer.destroy();
  }
}
