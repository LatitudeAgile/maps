// Pure formatting for the hello-world component, kept apart from the element so it
// needs no browser. Keep your own component's logic in files like this one.

/** "-104.99, 39.74": longitude then latitude, to two decimal places. */
export function formatCenter(longitude: number, latitude: number): string {
  return `${longitude.toFixed(2)}, ${latitude.toFixed(2)}`;
}

/** "1:18,489,298": the scale, rounded, with thousands separators. */
export function formatScale(scale: number): string {
  return `1:${Math.round(scale).toLocaleString("en-US")}`;
}
