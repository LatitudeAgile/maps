// The Buffalo River's centerline as [longitude, latitude] pairs, from its headwaters near Dixon Ford
// to the White River. From the USGS National Hydrography Dataset (public domain): the 363
// large-scale flowlines named "Buffalo River" (GNIS 00081847) in
// https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6, joined end to end and
// resampled every 42.5 m, about the spacing of the path brokan.xyz/buffalo used. Even spacing keeps
// the level model's smoothing (at most one step per segment) the same along the river.
import path from "./riverPath.json";

/** Path vertices in WGS84, upstream first. Segment i runs from vertex i to vertex i + 1. */
export const riverPath = path as [number, number][];
