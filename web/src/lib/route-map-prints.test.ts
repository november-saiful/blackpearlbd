import { describe, expect, it } from 'vitest';
import {
  boxOverlapArea,
  layoutPrintsAtScale,
  naturalPrintBox,
  placedPrintBox,
  planPrintLayout,
  printAnchorDrop,
  printEdgeRoom,
  printGap,
  printPinBox,
  printPinRoom,
  printReach,
  printReachFor,
  printScales,
  printSize,
  printSpots,
  type PrintBox,
  type PrintLayoutRequest,
  type PrintPoint,
} from './route-map-prints';

/** A pin at (x, y) in map pixels, with the stop index it belongs to. */
const pin = (x: number, y: number): PrintPoint => ({ x, y });

/**
 * What `PrintDeclutter` hands the layout: every stop's pin, the stops that have a
 * print, and the frame. `printIndexes` defaults to every stop having one.
 */
function request(
  pins: PrintPoint[],
  size = { width: 900, height: 420 },
  printIndexes = pins.map((_, index) => index),
): PrintLayoutRequest {
  return { pins, printIndexes, size, anchorDrop: printAnchorDrop };
}

/** Every print's box for a finished plan, so tests can measure the result. */
function boxesOf(layout: ReturnType<typeof planPrintLayout>, pins: PrintPoint[]): PrintBox[] {
  return layout.placements.map((placement) =>
    placedPrintBox(pins[placement.index], layout.scale, placement, printAnchorDrop),
  );
}

function worstOverlap(boxes: PrintBox[]): number {
  let worst = 0;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      worst = Math.max(worst, boxOverlapArea(boxes[i], boxes[j]));
    }
  }
  return worst;
}

describe('natural print placement', () => {
  it('hangs the print above its pin without covering it', () => {
    const boxes = [naturalPrintBox(pin(200, 300), 1)];
    const [box] = boxes;

    expect(box.bottom).toBeLessThan(300 - printPinRoom);
    expect(boxOverlapArea(box, printPinBox(pin(200, 300)))).toBe(0);
  });

  it('keeps the print centred on its pin', () => {
    const box = naturalPrintBox(pin(200, 300), 1);

    expect((box.left + box.right) / 2).toBe(200);
    expect(box.bottom - box.top).toBe(printSize.height - 2 * 3);
  });

  it('is sized the print down and up from the pin as the scale shrinks', () => {
    const full = naturalPrintBox(pin(200, 300), 1);
    const small = naturalPrintBox(pin(200, 300), 0.72);

    // The bottom edge is the one thing that must not move: the paper folds upwards.
    expect(small.bottom).toBe(full.bottom);
    expect(small.left).toBeGreaterThan(full.left);
    expect(small.top).toBeGreaterThan(full.top);
  });

  it('gives the fold back to the print on its way down to the pin', () => {
    expect(printReachFor(1)).toBe(printReach);
    expect(printReachFor(0.72)).toBe(printReach - 12);
    expect(printReachFor(0.72)).toBeLessThan(printReachFor(0.85));
  });

  it('measures the print at the size it is drawn', () => {
    const box = naturalPrintBox(pin(200, 300), 0.85);

    expect(box.right - box.left).toBe(Math.round(printSize.width * 0.85) - 2 * 3);
  });
});

describe('placement options', () => {
  it('offers the pin-hugging spot first', () => {
    expect(printSpots()[0]).toEqual([0, 0]);
  });

  it('sidesteps by half a print before a full one', () => {
    const firstTier = printSpots().slice(0, 5);

    expect(firstTier.map(([dx]) => dx)).toEqual([0, -50, 50, -100, 100]);
    expect(firstTier.every(([, lift]) => lift === 0)).toBe(true);
  });

  it('climbs a whole print taller on each tier, and stays finite', () => {
    const spots = printSpots();
    const tier = printSize.height + printGap;

    expect(spots.length).toBeLessThanOrEqual(25);
    expect(spots.some(([dx, lift]) => dx === 0 && lift === tier)).toBe(true);
    expect(Math.max(...spots.map(([, lift]) => lift))).toBe(tier * 3);
  });
});

describe('fanning prints apart', () => {
  it('leaves a lone print on its pin', () => {
    const pins = [pin(400, 300)];
    const plan = planPrintLayout(request(pins));

    expect(plan.scale).toBe(1);
    expect(plan.leftover).toBe(0);
    expect(plan.placements[0]).toMatchObject({ dx: 0, lift: 0 });
  });

  it('keeps earlier stops on their pins and moves only the crowded ones', () => {
    const pins = [pin(400, 300), pin(440, 300), pin(480, 300)];
    const plan = planPrintLayout(request(pins));

    expect(plan.leftover).toBe(0);
    expect(plan.placements[0]).toMatchObject({ dx: 0, lift: 0 });
    expect(plan.placements.some((placement) => placement.dx !== 0)).toBe(true);
    expect(worstOverlap(boxesOf(plan, pins))).toBe(0);
  });

  it('sidesteps instead of climbing when a neighbour is right beside it', () => {
    const pins = [pin(400, 300), pin(430, 300)];
    const plan = planPrintLayout(request(pins));
    const moved = plan.placements[1];

    expect(moved.dx).not.toBe(0);
    expect(moved.lift).toBe(0);
  });

  it('places prints at the same size regardless of the order the stops came in', () => {
    const pins = [pin(400, 300), pin(410, 296), pin(405, 305)];
    const first = planPrintLayout(request(pins));
    const again = planPrintLayout(request(pins));

    expect(again).toEqual(first);
  });
});

describe('tier climbing', () => {
  it('stacks prints that sit on top of each other into ascending tiers', () => {
    const pins = [pin(450, 320), pin(452, 320), pin(448, 320), pin(450, 318)];
    const plan = planPrintLayout(request(pins));
    const lifts = plan.placements.map((placement) => placement.lift);

    expect(plan.leftover).toBe(0);
    expect(new Set(lifts).size).toBeGreaterThan(1);
    expect(worstOverlap(boxesOf(plan, pins))).toBe(0);
  });

  it('climbs in whole tiers of a print plus the gap', () => {
    const pins = Array.from({ length: 6 }, () => pin(450, 320));
    const plan = planPrintLayout(request(pins, { width: 900, height: 420 }));
    const tier = printSize.height + printGap;

    expect(plan.leftover).toBe(0);
    expect(plan.placements.some((placement) => placement.lift > 0)).toBe(true);
    for (const placement of plan.placements) {
      expect(placement.lift % tier).toBe(0);
    }
  });

  it('keeps every print inside the frame instead of climbing off the top', () => {
    // Four prints on one spot near the top edge: the climb is out of frame, so the
    // last print has to settle for an overlapping spot rather than hang off the map.
    const pins = [pin(450, 110), pin(450, 110), pin(450, 110), pin(450, 110)];
    const size = { width: 900, height: 420 };
    const plan = planPrintLayout(request(pins, size));

    expect(plan.leftover).toBeGreaterThan(0);
    for (const box of boxesOf(plan, pins)) {
      expect(box.top).toBeGreaterThanOrEqual(printEdgeRoom - 1);
      expect(box.bottom).toBeLessThanOrEqual(size.height - printEdgeRoom + 1);
      expect(box.left).toBeGreaterThanOrEqual(printEdgeRoom - 1);
      expect(box.right).toBeLessThanOrEqual(size.width - printEdgeRoom + 1);
    }
  });
});

describe('pins as obstacles', () => {
  it('moves a print that would otherwise bury another stop', () => {
    // The print for the southern stop would naturally cover the northern pin.
    const pins = [pin(450, 320), pin(450, 232)];
    const plan = planPrintLayout(request(pins, { width: 900, height: 420 }, [0]));
    const printBox = boxesOf(plan, pins)[0];

    expect(plan.placements[0].dx + plan.placements[0].lift).not.toBe(0);
    expect(boxOverlapArea(printBox, printPinBox(pins[1]))).toBe(0);
  });

  it('never places a print over another stop', () => {
    const pins = [pin(450, 320), pin(470, 318), pin(430, 322), pin(450, 300), pin(410, 310)];
    const plan = planPrintLayout(request(pins));

    boxesOf(plan, pins).forEach((box) => {
      pins.forEach((other) => {
        expect(boxOverlapArea(box, printPinBox(other))).toBe(0);
      });
    });
  });

  it('does not let a print be pushed off its own pin by that pin', () => {
    // Leaflet's gap is learned at runtime and can come back small; even then a print
    // only ever brushes past its own pin, which must not count as being crowded.
    const pins = [pin(400, 300)];
    const plan = layoutPrintsAtScale(
      { pins, printIndexes: [0], size: { width: 900, height: 420 }, anchorDrop: 0 },
      1,
    );

    expect(plan.placements[0]).toMatchObject({ dx: 0, lift: 0 });
    expect(plan.leftover).toBe(0);
  });

  it('ignores a stop index that has no print of its own', () => {
    const pins = [pin(450, 320), pin(450, 232)];
    const withPrint = planPrintLayout(request(pins, { width: 900, height: 420 }, [0]));
    const both = planPrintLayout(request(pins, { width: 900, height: 420 }, [0, 1]));

    expect(withPrint.placements).toHaveLength(1);
    expect(both.placements).toHaveLength(2);
  });
});

describe('the shrink ladder', () => {
  it('stays at full size when the map can hold the prints apart', () => {
    const pins = [pin(100, 300), pin(300, 300), pin(500, 300), pin(700, 300)];
    const plan = planPrintLayout(request(pins));

    expect(plan.scale).toBe(1);
    expect(plan.leftover).toBe(0);
  });

  it('shrinks the prints when a dense cluster cannot be spread out at all', () => {
    const pins = [pin(180, 140), pin(182, 141), pin(178, 139), pin(181, 143), pin(179, 137), pin(183, 144)];
    const size = { width: 380, height: 240 };
    const full = layoutPrintsAtScale(request(pins, size), 1);
    const plan = planPrintLayout(request(pins, size));

    expect(printScales).toContain(plan.scale);
    expect(plan.scale).toBeLessThan(1);
    expect(plan.leftover).toBeLessThan(full.leftover);
  });

  it('never shrinks past the smallest print size, and reports what is left', () => {
    const pins = Array.from({ length: 8 }, (_, index) => pin(200 + index, 120));
    const plan = planPrintLayout(request(pins, { width: 300, height: 200 }));

    expect(plan.scale).toBe(printScales[printScales.length - 1]);
    expect(plan.placements).toHaveLength(pins.length);
    expect(plan.leftover).toBeGreaterThan(0);
  });

  it('gives every print a placement even when nothing fits', () => {
    const pins = [pin(5, 5), pin(6, 6)];
    const plan = planPrintLayout(request(pins, { width: 20, height: 20 }));

    expect(plan.placements.map((placement) => placement.index).sort()).toEqual([0, 1]);
    expect(plan.placements.every((placement) => Number.isFinite(placement.dx))).toBe(true);
  });
});

describe('the layout request', () => {
  it('accepts a frame that has not been measured yet', () => {
    const plan = planPrintLayout(request([pin(0, 0)], { width: 0, height: 0 }));

    expect(plan.placements).toHaveLength(1);
    expect(plan.leftover).toBeGreaterThan(0);
  });

  it('has no work to do without a print', () => {
    const plan = planPrintLayout(request([pin(400, 300), pin(500, 300)], { width: 900, height: 420 }, []));

    expect(plan.placements).toEqual([]);
    expect(plan.leftover).toBe(0);
  });

  it('keeps the reach it used, so the map can apply it', () => {
    const plan = planPrintLayout(request([pin(400, 300)]));

    expect(plan.reach).toBe(printReachFor(plan.scale));
  });
});

describe('print geometry helpers', () => {
  it('reports overlap only where two boxes actually cross', () => {
    const a: PrintBox = { left: 0, top: 0, right: 10, bottom: 10 };

    expect(boxOverlapArea(a, { left: 5, top: 5, right: 15, bottom: 15 })).toBe(25);
    expect(boxOverlapArea(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(0);
  });
});
