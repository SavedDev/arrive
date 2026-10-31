// The map sheet hands the adjusted pin back to the place editor that opened it.
// Only one editor is open at a time, so a single listener is enough.
export type Coordinate = { latitude: number; longitude: number };

let start: Coordinate | undefined;
let listener: ((c: Coordinate) => void) | null = null;

/** The editor listens for the pin chosen on the map sheet. */
export function onMapPicked(fn: (c: Coordinate) => void) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
/** Where the map sheet opens: the editor's current pin, if it has one. */
export function setMapStart(c: Coordinate | undefined) {
  start = c;
}
export const mapStart = () => start;
export function pickOnMap(c: Coordinate) {
  listener?.(c);
}
