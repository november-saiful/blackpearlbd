/**
 * Tiny tick-click player for the WheelPicker.
 * Uses the Web Audio API to produce a short, quiet click each time the
 * selected value changes. No audio files needed.
 */

let ctx: AudioContext | null = null;

function getCtx() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function createTickPlayer() {
  let prepared = false;

  return {
    /** Call on pointer-down / wheel-start to unlock the AudioContext. */
    prepare() {
      try {
        getCtx().resume();
        prepared = true;
      } catch {
        /* no-op, audio not available */
      }
    },

    /** Play a single short click. */
    play() {
      try {
        const ac = getCtx();
        if (ac.state === "suspended") ac.resume();

        const osc = ac.createOscillator();
        const gain = ac.createGain();

        osc.type = "sine";
        osc.frequency.value = 1800 + Math.random() * 400;

        gain.gain.setValueAtTime(0.04, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(ac.destination);

        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.05);
      } catch {
        /* no-op, audio not available */
      }
    },

    /** Release resources when the picker unmounts. */
    dispose() {
      prepared = false;
    },
  };
}
