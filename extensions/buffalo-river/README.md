# buffalo-river

The Buffalo River in Arkansas, in a 3D scene, coloured by an estimated floating level from live
USGS river gauges. It plans float trips between the river's access points. The Buffalo River
sample app (`?app=buffalo-river`) uses it.

Adapted with the author's permission from Buffalo River at
[brokan.xyz/buffalo](https://brokan.xyz/buffalo).

## What it does

When it's added to a scene, it adds these layers, which the layer list and legend pick up:

| Layer | What it shows |
|---|---|
| Access points | The 28 places to put in or take out. Primitive accesses (no developed ramp or parking) are orange. |
| Points of interest | A group with a layer for each kind of place, so the layer list turns each on and off: River gauges, Streams, Bluffs, Hollows, Trails, Bridges and Other. Click one for its popup. |
| Buffalo River | The river from its headwaters to the White River, coloured Very Low, Low, Moderate, High or Flood. |
| Lower Buffalo Wilderness | The wilderness along the river's last miles, above the White River. |
| Ponca Wilderness | The wilderness around Ponca and Steel Creek. |
| Upper Buffalo Wilderness | The wilderness around the river's headwaters, the Forest Service's and the Park Service's parts as one area. |
| Buffalo National River boundary | The park's boundary, from the National Park Service. |

River gauges are the six USGS gauges on the river, live from the
[Live Stream Gauges](https://rhvpkkiftonktxq3.svcs9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/Live_Stream_Gauges_v1/FeatureServer/0)
service in ArcGIS Living Atlas. Their popups show the latest flow and height, and link to each
station's page. Carver's gauge is listed there but hasn't reported for months.

Its sidebar panel has:

- **River levels:** the time of the reading the river is drawn for, a slider and Play button for
  the last 48 hours, and Refresh. Under them, a key to the colours: a bar that blends the five
  bands as the river does, with a marker at the selected trip's level, and **What the colours
  mean** with each band's guidance. If the readings can't be loaded, a notice offers Retry, the
  river is drawn in grey, the key is hidden, and the rest keeps working.
- **Trip:** click two access points on the map (the panel opens if it's closed). It shows the put-in and take-out in
  downstream order, the distance, the paddling time at 2.5 mph, and the level at the newest
  reading. **Trip details** adds a date to plan for, daylight and the latest launch, maps of the
  stretch, the points of interest along it, and directions in Google Maps.

The first time it's shown in an app, a warning that the levels are estimates must be
acknowledged. That's kept per app in the browser.

### How levels are estimated

Every 15 minutes, five USGS gauges report discharge, in cubic feet per second: Boxley
(`USGS-07055646`), Ponca (`USGS-07055660`), Pruitt (`USGS-07055680`), St. Joe (`USGS-07056000`) and
Harriet (`USGS-07056700`). Each gauge has its own discharge range for each band.

The river path is split into 5,643 segments of about 42.5 m, and each segment's score is worked out from the gauges
on either side of it. Their discharges and their bands are blended by distance. Above Boxley and
below Harriet, the nearest gauge is used alone. A score changes by at most one point from one
segment to the next, so there are no jumps at the gauges.

The readings come from the
[USGS Water Data API](https://api.waterdata.usgs.gov/ogcapi/v1/), with no key. They're fetched
once when the component starts, and again on Refresh.

The access points and points of interest come from brokan.xyz/buffalo. The river path is the
USGS [National Hydrography Dataset](https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6)'s
large-scale flowlines named Buffalo River, joined end to end and resampled every 42.5 m (see
`data/riverPath.ts`). The park boundary is read live from the
[National Park Service's boundaries](https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2),
filtered to `UNIT_CODE = 'BUFF'`. The wilderness areas are read once when the component starts
from [Wilderness Connect's National Wilderness Preservation System](https://services1.arcgis.com/ERdCHt0sNM6dENSD/arcgis/rest/services/Wilderness_Areas_in_the_United_States/FeatureServer/0):
the Upper Buffalo Wilderness (Forest Service) and Buffalo National River Wilderness (Park
Service), which the service has as one feature in five parts. The Park Service's part next to the
Upper Buffalo joins it, the part around Ponca is Ponca Wilderness, and the four parts near the
White River are the Lower Buffalo. All four services are public.

At first only the river and the access points show; every point of interest layer, the gauges
among them, the wilderness areas and the park boundary are off until turned on in the layer
list.

## Options

This type has no options.

## Config

Add this entry to the `components` of an app whose `map.view` is `"3d"`:

```json
{ "id": "river", "type": "buffalo-river" }
```

The sample app, `public/apps/buffalo-river.json`, starts with the whole river in view, on
OpenStreetMap and world terrain.

## Where it works

- **Placements:** sidebar panel only.
- **Views:** 3D scenes only. The point symbols use 3D icons with callouts.
- **No API key needed.**

**Map clicks:** clicks on access points always go to the trip, even while another tool is
using the map. If an app also has Measure or Sketch in the sidebar, a click on an access point
while measuring or sketching switches the sidebar to this panel. Put those tools in a map corner, as
the sample app does with Measure in the bottom left, or leave them out.

## Reading it as an example

This is the full example to read after [`hello-world`](../hello-world/): a component built only
on the viewer API, with real data, a service and map interaction.

| To see how to... | Read |
|---|---|
| Add layers to the scene and remove them when the element is removed | `layers.ts` (`RiverLayers`), `BuffaloRiver.ts` (`#start`, `disconnectedCallback`) |
| Cancel a request and timers when the element is removed | `BuffaloRiver.ts` (`#load`, its `AbortController`) |
| Take clicks on the map for one layer only | `BuffaloRiver.ts` (`#onMapClick`, a filtered `hitTest`) |
| Ask for the panel to open | `BuffaloRiver.ts` (`requestPanelOpen`) |
| Pause work when the panel closes | `BuffaloRiver.ts` (`PANEL_CLOSE`) |
| Keep settings per app | `storage.ts` (`appStorageKey`) |
| Group layers so the layer list shows each one | `layers.ts` (`RiverLayers.poi`, a `GroupLayer`) |
| Add a live service layer, filtered | `layers.ts` (`gaugeLayer`, `parkLayer`) |
| Show a second page in the panel | `BuffaloRiver.ts` (`#openTripDetails`), `tripDetails.ts` |
| Keep model code apart from the UI | `levels.ts`, `trip.ts`, `sun.ts`, `dates.ts`, `geo.ts`, `minimap.ts`: none import the element |

## Files

| File | What it holds |
|---|---|
| `component.ts` | The manifest: panel only, 3D only, no options. |
| `index.ts` | Defines the element once. The manifest's `load` imports it. |
| `BuffaloRiver.ts` | The element: finds the scene, holds the state, builds the panel. |
| `levelKey.ts` | The River levels block's key to the level colours. |
| `tripBlock.ts`, `tripDetails.ts` | The panel's Trip block and its Trip details page. |
| `warning.ts` | The one-time safety warning. |
| `layers.ts`, `poiPopup.ts` | The scene's layers, their symbols and the points-of-interest popup. |
| `levels.ts` | The gauges, the USGS request, and the level score of each segment. |
| `trip.ts`, `minimap.ts` | Trip distance, time and points, and the SVG maps of a trip. |
| `sun.ts`, `dates.ts`, `geo.ts` | Sunrise and sunset (NOAA's equations), calendar days, distances. |
| `storage.ts` | What's kept per app in the browser. |
| `data/`, `icons/` | The river path, access points, and points of interest (one data set per kind in `data/pointsOfInterest/`), and their map icons. |
