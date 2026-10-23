import { afterEach, describe, expect, it, vi } from 'vitest';

import { HOVER_GATE_MS, WHEEL_CONTINUES_MS, attachScrollHoverGate } from './scroll-hover-gate';

const FLAG = 'data-scrolling';

/** The gate only ever needs an attribute and three events, so a stub stands in
 *  for the scroller and the cases can read the flag directly. */
class FakeScroller {
  private readonly attrs = new Set<string>();
  private readonly listeners = new Map<string, Set<() => void>>();

  hasAttribute(name: string) {
    return this.attrs.has(name);
  }

  setAttribute(name: string) {
    this.attrs.add(name);
  }

  removeAttribute(name: string) {
    this.attrs.delete(name);
  }

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

/** A clock the case winds forward itself, so the two windows can be straddled
 *  without waiting on a fake timer's idea of what performance.now should be. */
function makeClock() {
  let ms = 0;
  return {
    now: () => ms,
    advance: (by: number) => {
      ms += by;
    },
  };
}

function fresh() {
  vi.useFakeTimers();
  const target = new FakeScroller();
  const clock = makeClock();
  const detach = attachScrollHoverGate(target, clock.now);
  return { target, clock, detach };
}

describe('scroll hover gate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags the scroller on a wheel and clears it once the page has settled', () => {
    const { target } = fresh();
    target.emit('wheel');
    expect(target.hasAttribute(FLAG)).toBe(true);
    vi.advanceTimersByTime(HOVER_GATE_MS - 1);
    expect(target.hasAttribute(FLAG)).toBe(true);
    vi.advanceTimersByTime(2);
    expect(target.hasAttribute(FLAG)).toBe(false);
  });

  it('keeps the flag through a glide that reports no wheel of its own', () => {
    const { target, clock } = fresh();
    target.emit('wheel');
    clock.advance(WHEEL_CONTINUES_MS / 2);
    vi.advanceTimersByTime(HOVER_GATE_MS);
    expect(target.hasAttribute(FLAG)).toBe(false);
    target.emit('scroll');
    expect(target.hasAttribute(FLAG)).toBe(true);
  });

  it('ignores movement that is not wheel driven', () => {
    const { target, clock } = fresh();
    target.emit('wheel');
    clock.advance(WHEEL_CONTINUES_MS + 1);
    vi.advanceTimersByTime(HOVER_GATE_MS);
    target.emit('scroll');
    expect(target.hasAttribute(FLAG)).toBe(false);
  });

  it('lets go the moment the pointer presses, so a click is not held hostage', () => {
    const { target } = fresh();
    target.emit('wheel');
    target.emit('pointerdown');
    expect(target.hasAttribute(FLAG)).toBe(false);
    vi.advanceTimersByTime(HOVER_GATE_MS * 2);
    expect(target.hasAttribute(FLAG)).toBe(false);
  });

  it('stops flagging once detached', () => {
    const { target, detach } = fresh();
    detach();
    target.emit('wheel');
    expect(target.hasAttribute(FLAG)).toBe(false);
  });
});
