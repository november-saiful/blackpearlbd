/**
 * Geometry for the polaroid prints that hang off the tour route map's pins.
 *
 * Everything here is pure: it takes pin positions in map pixels and answers where
 * each print should sit, so the placement of the prints can be reasoned about and
 * tested without a browser, a map or a rendered print.
 */

/** Layout size of one print, in pixels. The print element is sized from these two. */
export const printSize = { width: 100, height: 88 };
/** Breathing room kept between two prints that would otherwise touch. */
export const printGap = 6;
/** How far a print's bottom edge sits above its pin, before decluttering. */
export const printReach = 14;
/** A rotated print pokes this far past its own frame; kept clear in every box. */
export const printTilt = 3;
/** Half a pin plus a little clearance, so a moved print never buries a stop. */
export const printPinRoom = 15 + 3;
/** Gap kept between a print and the edge of the map, past its tilted corner. */
export const printEdgeRoom = 2 * printTilt + 2;
/** Tiny tilts (degrees) so neighbouring prints sit like scattered prints, not a grid. */
export const polaroidTilts = [-3, 2.5, -1.5, 3];
/**
 * Sizes a print may be drawn at, largest first. Full size is the default; the
 * smaller ones are only reached when a map cannot hold the prints apart, because a
 * legibly smaller print beats two prints stacked on each other.
 */
export const printScales = [1, 0.85, 0.72];
/**
 * Room a polaroid claims above its pin: the print's height, the offset off the pin
 * and the tilt overhang. Reserved when fitting the map bounds, so no print is clipped.
 */
export const polaroidRoof = printSize.height + printReach + printTilt + 5;
/**
 * Ceiling for that reservation. On a short map the roof is padded out to a share of
 * the height instead, because a taller reservation would zoom the route out to
 * nothing — a slightly tighter crop of one print is the better trade there.
 */
export const polaroidRoofMax = 122;
/** Width a polaroid claims either side of its pin (half a print, plus margin). */
export const polaroidWing = printSize.width / 2 + printGap + 2;
/**
 * Leaflet hangs a marker's tooltip a few pixels higher than its own anchor maths
 * suggests. The map reads that gap off a print that is on screen and keeps it; this
 * is the value it starts from until it has one to read.
 */
export const printAnchorDrop = 6;
/** Climb tiers a print may try before it has to settle for an overlapping spot. */
export const printClimbTiers = 4;

export interface PrintPoint {
  x: number;
  y: number;
}

export interface PrintBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PrintSize {
  width: number;
  height: number;
}

export interface PrintPlacement {
  /** Index of the stop this print belongs to, in the map's stop order. */
  index: number;
  /** Pixels to shift the print off its pin, sideways. */
  dx: number;
  /** Pixels to lift it above its reached spot, in whole tiers. */
  lift: number;
  /** Overlap left at the spot it settled on, in square pixels. */
  overlap: number;
}

export interface PrintLayoutRequest {
  /**
   * Every stop's pin, in the map's stop order: index into this array *is* the stop's
   * index. Stops without a photo still need their pin here — they are obstacles.
   */
  pins: PrintPoint[];
  /** Stops that carry a print, in the order they should be placed (route order). */
  printIndexes: number[];
  /** Size of the map's frame, in pixels. */
  size: PrintSize;
  /** Leaflet's tooltip gap for this map (see `printAnchorDrop`). */
  anchorDrop?: number;
}

export interface PrintLayout {
  /** Size the prints are drawn at, one of `printScales`. */
  scale: number;
  /** Offset from the pin to the print's own box, which the map applies to each print. */
  reach: number;
  placements: PrintPlacement[];
  /** Overlap left behind across all prints: 0 means every print found a clear spot. */
  leftover: number;
}

export function printPinBox(pin: PrintPoint): PrintBox {
  return {
    left: pin.x - printPinRoom,
    top: pin.y - printPinRoom,
    right: pin.x + printPinRoom,
    bottom: pin.y + printPinRoom,
  };
}

export function shiftBox(box: PrintBox, dx: number, dy: number): PrintBox {
  return { left: box.left + dx, top: box.top + dy, right: box.right + dx, bottom: box.bottom + dy };
}

export function boxOverlapArea(a: PrintBox, b: PrintBox): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

export function boxInside(box: PrintBox, size: PrintSize, margin: number): boolean {
  return box.left >= margin && box.top >= margin && box.right <= size.width - margin && box.bottom <= size.height - margin;
}

/**
 * How far a print's own box sits above its pin at this size. The paper folds inwards
 * around its middle as it shrinks, so a smaller print keeps the same bottom edge by
 * giving that fold back on the way down to the pin.
 */
export function printReachFor(scale: number): number {
  return printReach - Math.round(((1 - scale) * printSize.height) / 2);
}

/**
 * Where a print of `scale` lands on its own pin before any decluttering, with the
 * tilt overhang discounted. Worked out from the pin rather than measured off the
 * element: a layout can be asked for before the prints have painted, and an empty
 * tooltip measures as nothing at all — which would read as an empty map.
 */
export function naturalPrintBox(pin: PrintPoint, scale: number, anchorDrop = printAnchorDrop): PrintBox {
  const halfWidth = (printSize.width * scale) / 2;
  // The bottom edge stays put at every size: the fold a shrunken print loses on the
  // way down to its pin is given back through the reach the map applies.
  const bottom = pin.y - printReach - anchorDrop;
  // The paper is drawn tilted and a rotated box measures wider than it is, so the
  // overhang is discounted: two frames that only touch corners count as clear.
  return {
    left: pin.x - halfWidth + printTilt,
    top: bottom - printSize.height * scale + printTilt,
    right: pin.x + halfWidth - printTilt,
    bottom: bottom - printTilt,
  };
}

/** The box a placement puts a print in: its natural box, shifted and lifted. */
export function placedPrintBox(
  pin: PrintPoint,
  scale: number,
  placement: PrintPlacement,
  anchorDrop = printAnchorDrop,
): PrintBox {
  return shiftBox(naturalPrintBox(pin, scale, anchorDrop), placement.dx, -placement.lift);
}

/**
 * Spots a print may take, nearest to its pin first: hug the pin, sidestep, then climb
 * a tier — repeated, so a dense cluster becomes readable tiers of prints instead of
 * one pile. Distances are in pixels and side steps are half a print, so a neighbour
 * only ever covers a print's edge, never its photo.
 */
export function printSpots(): Array<[number, number]> {
  const spots: Array<[number, number]> = [];
  for (let climb = 0; climb < printClimbTiers; climb += 1) {
    for (const step of [0, -0.5, 0.5, -1, 1]) {
      spots.push([step * printSize.width, climb * (printSize.height + printGap)]);
    }
  }
  return spots;
}

/**
 * Places every print at one size. Nothing here touches a map, so a caller can try
 * another size without the prints visibly moving in between.
 */
export function layoutPrintsAtScale(
  request: PrintLayoutRequest,
  scale: number,
): Omit<PrintLayout, 'scale'> {
  const anchorDrop = request.anchorDrop ?? printAnchorDrop;
  const reach = printReachFor(scale);
  // Pins come first, so a box's index in here equals its stop's index; prints are
  // pushed after them and can never share an index with a stop.
  const boxes: PrintBox[] = request.pins.map(printPinBox);
  const spots = printSpots();
  const placements: PrintPlacement[] = [];
  let leftover = 0;

  for (const index of request.printIndexes) {
    const natural = naturalPrintBox(request.pins[index], scale, anchorDrop);
    let best: (PrintPlacement & { box: PrintBox }) | null = null;

    for (const [dx, lift] of spots) {
      const box = shiftBox(natural, dx, -lift);
      if (!boxInside(box, request.size, printEdgeRoom)) continue;
      const overlap = boxes.reduce(
        // Its own pin is no obstacle: a print always sits above its pin.
        (total, other, otherIndex) => (otherIndex === index ? total : total + boxOverlapArea(box, other)),
        0,
      );
      if (!best || overlap < best.overlap) best = { box, dx, lift, overlap, index };
      if (overlap === 0) break;
    }

    // Nowhere clear to stand: leave the print on its pin and let it overlap.
    if (!best) {
      leftover += 1;
      placements.push({ index, dx: 0, lift: 0, overlap: 0 });
      continue;
    }

    boxes.push(best.box);
    leftover += best.overlap;
    placements.push({ index: best.index, dx: best.dx, lift: best.lift, overlap: best.overlap });
  }

  return { reach, placements, leftover };
}

/**
 * Picks the largest size the map can hold the prints apart at, falling back to the
 * smallest one when a cluster is simply too tight for the frame — a crowded map of
 * smaller prints reads better than a pile of full-size ones.
 */
export function planPrintLayout(request: PrintLayoutRequest): PrintLayout {
  let plan = layoutPrintsAtScale(request, printScales[0]);
  let scale = printScales[0];

  for (const candidate of printScales.slice(1)) {
    if (plan.leftover === 0) break;
    plan = layoutPrintsAtScale(request, candidate);
    scale = candidate;
  }

  return { ...plan, scale };
}
