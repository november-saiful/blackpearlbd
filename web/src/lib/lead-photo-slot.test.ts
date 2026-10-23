import { afterEach, describe, expect, it, vi } from 'vitest';

// The gate is module state, so each case needs a fresh copy of the file. The
// timers are faked because the release on a request that never answers is the
// only thing standing between one dead photo and a grid of empty frames.
async function freshGate() {
  vi.resetModules();
  vi.useFakeTimers();
  return await import('./lead-photo-slot');
}

describe('lead photo slot', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives the slot to the first card and to nobody else', async () => {
    const gate = await freshGate();
    expect(gate.claimLeadPhotoSlot()).toBe(true);
    expect(gate.claimLeadPhotoSlot()).toBe(false);
  });

  it('holds the rest of the grid until the lead answers, then lets all go', async () => {
    const gate = await freshGate();
    gate.claimLeadPhotoSlot();
    const started: number[] = [];
    gate.onLeadPhotoSettled(() => started.push(1));
    gate.onLeadPhotoSettled(() => started.push(2));
    expect(started).toEqual([]);
    gate.settleLeadPhotoSlot();
    expect(started).toEqual([1, 2]);
    // Settled is settled: a card mounted after it, on this page or the next, waits for nothing.
    const late = vi.fn();
    gate.onLeadPhotoSettled(late);
    expect(late).toHaveBeenCalled();
  });

  it('never blocks a page whose cards own no photo', async () => {
    const gate = await freshGate();
    const started = vi.fn();
    gate.onLeadPhotoSettled(started);
    expect(started).toHaveBeenCalled();
  });

  it('releases the slot when the lead request never answers', async () => {
    const gate = await freshGate();
    gate.claimLeadPhotoSlot();
    const started = vi.fn();
    const detach = gate.onLeadPhotoSettled(started);
    expect(started).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4_000);
    expect(started).toHaveBeenCalled();
    detach();
    gate.settleLeadPhotoSlot();
    expect(started).toHaveBeenCalledTimes(1);
  });
});
