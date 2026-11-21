// The layers one tracks element adds to its map (design D5, D6): a "Tracks" group, holding one
// group per library entry that's been turned on this session. An entry's group lists as one row
// in the layer list and holds its lines and, when the file has any, its waypoints. In 3D the lines
// are draped on the ground, and the waypoints stand on it, facing the camera.
import Graphic from "@arcgis/core/Graphic.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import Point from "@arcgis/core/geometry/Point.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import GroupLayer from "@arcgis/core/layers/GroupLayer.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import type { GpxData, LinePoint } from "./gpx.ts";

/** Prefixed so it can't collide with a layer from the app's config. */
export const GROUP_ID = "viewer-tracks";

const WGS84 = { wkid: 4326 };
const ON_THE_GROUND = { mode: "on-the-ground" } as const;
/**
 * Waypoints sit at the ground's height, whatever the file recorded (their geometry has no z), but
 * aren't draped: a draped marker lies flat and nearly vanishes when the view is tilted.
 */
const ON_THE_GROUND_UPRIGHT = { mode: "relative-to-ground", offset: 0 } as const;

interface EntryLayers {
  group: GroupLayer;
  lines: FeatureLayer | undefined;
  waypoints: FeatureLayer | undefined;
  watch: ResourceHandle;
}

export class TrackLayers {
  #view: MapView | SceneView;
  #group: GroupLayer | undefined;
  #entries = new Map<string, EntryLayers>();

  constructor(view: MapView | SceneView) {
    this.#view = view;
  }

  has(id: string): boolean {
    return this.#entries.has(id);
  }

  /**
   * Builds an entry's layers on top of the "Tracks" group, adding the group to the map first if
   * it isn't there. `onVisible` is called whenever the entry's group is shown or hidden, from the
   * panel or the layer list.
   */
  add(id: string, name: string, color: string, data: GpxData, visible: boolean, onVisible: (visible: boolean) => void): void {
    if (this.#entries.has(id)) return;
    const lines = linesLayer(data, color);
    const waypoints = waypointsLayer(data, color);
    const group = new GroupLayer({
      id: `${GROUP_ID}-${id}`,
      title: name,
      listMode: "hide-children",
      visible,
      // Waypoints draw above the lines; a group lists and draws its last layer on top.
      layers: [lines, waypoints].filter((layer): layer is FeatureLayer => layer !== undefined),
    });
    const watch = reactiveUtils.watch(
      () => group.visible,
      (value) => onVisible(value),
    );
    this.#entries.set(id, { group, lines, waypoints, watch });
    this.#tracksGroup().add(group);
  }

  setVisible(id: string, visible: boolean): void {
    const entry = this.#entries.get(id);
    if (entry) entry.group.visible = visible;
  }

  rename(id: string, name: string): void {
    const entry = this.#entries.get(id);
    if (entry) entry.group.title = name;
  }

  recolor(id: string, color: string): void {
    const entry = this.#entries.get(id);
    if (!entry) return;
    if (entry.lines) entry.lines.renderer = lineRenderer(color);
    if (entry.waypoints) entry.waypoints.renderer = waypointRenderer(color);
  }

  remove(id: string): void {
    const entry = this.#entries.get(id);
    if (!entry) return;
    this.#entries.delete(id);
    entry.watch.remove();
    this.#group?.remove(entry.group);
    entry.group.destroy();
    if (this.#group && this.#group.layers.length === 0) this.#removeTracksGroup();
  }

  /** Removes every layer this element added. */
  destroy(): void {
    for (const id of [...this.#entries.keys()]) this.remove(id);
    this.#removeTracksGroup();
  }

  #tracksGroup(): GroupLayer {
    if (!this.#group) {
      this.#group = new GroupLayer({ id: GROUP_ID, title: "Tracks", visibilityMode: "independent" });
      this.#view.map?.add(this.#group);
    }
    return this.#group;
  }

  #removeTracksGroup(): void {
    if (!this.#group) return;
    this.#view.map?.remove(this.#group);
    this.#group.destroy();
    this.#group = undefined;
  }
}

function linesLayer(data: GpxData, color: string): FeatureLayer | undefined {
  const paths: { path: LinePoint[]; kind: string }[] = [
    ...data.tracks.map((path) => ({ path, kind: "Track" })),
    ...data.routes.map((path) => ({ path, kind: "Route" })),
  ];
  if (!paths.length) return undefined;
  return new FeatureLayer({
    title: "Lines",
    source: paths.map(
      ({ path, kind }, i) =>
        new Graphic({
          geometry: new Polyline({ spatialReference: WGS84, paths: [path.map(({ lon, lat }) => [lon, lat])] }),
          attributes: { ObjectID: i + 1, Kind: kind },
        }),
    ),
    geometryType: "polyline",
    spatialReference: WGS84,
    objectIdField: "ObjectID",
    fields: [
      { name: "ObjectID", type: "oid" },
      { name: "Kind", type: "string" },
    ],
    renderer: lineRenderer(color),
    elevationInfo: ON_THE_GROUND,
    popupEnabled: false,
  });
}

function waypointsLayer(data: GpxData, color: string): FeatureLayer | undefined {
  if (!data.waypoints.length) return undefined;
  return new FeatureLayer({
    title: "Waypoints",
    source: data.waypoints.map(
      (waypoint, i) =>
        new Graphic({
          geometry: new Point({ spatialReference: WGS84, longitude: waypoint.lon, latitude: waypoint.lat }),
          attributes: { ObjectID: i + 1, Name: waypoint.name ?? "Waypoint", Description: waypoint.description ?? "" },
        }),
    ),
    geometryType: "point",
    spatialReference: WGS84,
    objectIdField: "ObjectID",
    fields: [
      { name: "ObjectID", type: "oid" },
      { name: "Name", type: "string" },
      { name: "Description", type: "string" },
    ],
    outFields: ["*"],
    renderer: waypointRenderer(color),
    elevationInfo: ON_THE_GROUND_UPRIGHT,
    popupTemplate: new PopupTemplate({ title: "{Name}", content: "{Description}" }),
  });
}

const lineRenderer = (color: string) => new SimpleRenderer({ symbol: new SimpleLineSymbol({ color, width: 3, cap: "round", join: "round" }) });

const waypointRenderer = (color: string) =>
  new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({ style: "circle", color, size: 10, outline: { color: "white", width: 1.5 } }),
  });
