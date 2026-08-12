/**
 * Dynamic route segments arrive percent-encoded. Decoding can throw on a
 * malformed segment (a lone `%`), in which case the raw value is still the most
 * useful thing to hand the caller — it will simply miss the cache and render an
 * empty state rather than crashing the route.
 */
export function decodeRouteSegment(segment?: string) {
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
