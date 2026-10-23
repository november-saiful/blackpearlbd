// One deal photo is roughly 200 KB and there is no smaller rendition to serve,
// so the first screen of a grid is limited by how much of the connection it can
// claim. Two photos started together each arrive about twice as late as one
// alone, and the earlier of them is what the browser reports as the paint. So
// the card that asks first gets the connection to itself and the rest start when
// it lands, fails, or runs out of patience.
let claimed = false;
let released = false;
const waiting = new Set<() => void>();

function release() {
  if (released) return;
  released = true;
  const pending = [...waiting];
  waiting.clear();
  for (const start of pending) start();
}

/**
 * Takes the first slot, or reports that another card already holds it. Call this
 * only when the image is about to mount.
 */
export function claimLeadPhotoSlot() {
  if (claimed) return false;
  claimed = true;
  // A request that never answers must not hold the rest of the grid hostage.
  setTimeout(release, 4000);
  return true;
}

/** Called by the lead card once its photo has loaded or errored. */
export function settleLeadPhotoSlot() {
  release();
}

/**
 * Runs `start` as soon as it is safe to download another photo, and returns a
 * detach. A slot nobody claimed never blocks anything, so a page of cards
 * without pictures, or one visited after the lead has landed, starts at once.
 */
export function onLeadPhotoSettled(start: () => void) {
  if (released || !claimed) {
    start();
    return () => {};
  }
  waiting.add(start);
  return () => {
    waiting.delete(start);
  };
}
