import { describe, expect, it, vi } from "vitest";
import { createContentRise } from "./content-rise";

function createFrameClock() {
  let callback: FrameRequestCallback | null = null;
  let nextHandle = 1;
  let activeHandle: number | null = null;

  return {
    requestAnimationFrame(next: FrameRequestCallback) {
      callback = next;
      activeHandle = nextHandle;
      nextHandle += 1;
      return activeHandle;
    },
    cancelAnimationFrame(handle: number) {
      if (handle === activeHandle) {
        callback = null;
        activeHandle = null;
      }
    },
    tick(timestamp: number) {
      const next = callback;
      callback = null;
      activeHandle = null;
      next?.(timestamp);
    },
    get pending() {
      return callback !== null;
    },
  };
}

describe("content rise", () => {
  it("snaps the visual offset then decays it toward zero", () => {
    const offsets: number[] = [];
    const clock = createFrameClock();
    const rise = createContentRise({
      applyOffset: (offset) => {
        offsets.push(offset);
      },
      requestAnimationFrame: (callback) => clock.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => clock.cancelAnimationFrame(handle),
      prefersReducedMotion: () => false,
    });

    rise.start(60);
    expect(offsets).toEqual([60]);
    expect(rise.getOffset()).toBe(60);

    clock.tick(1000);
    expect(offsets.at(-1)).toBe(60);

    clock.tick(1050);
    const decayed = offsets.at(-1);
    expect(decayed).toBeGreaterThan(0);
    expect(decayed).toBeLessThan(60);
  });

  it("adds a later arrival onto the running offset instead of restarting", () => {
    const offsets: number[] = [];
    const clock = createFrameClock();
    const rise = createContentRise({
      applyOffset: (offset) => {
        offsets.push(offset);
      },
      requestAnimationFrame: (callback) => clock.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => clock.cancelAnimationFrame(handle),
      prefersReducedMotion: () => false,
    });

    rise.start(60);
    clock.tick(1000);
    clock.tick(1050);
    const mid = offsets.at(-1) ?? 0;
    offsets.length = 0;

    rise.start(24);
    expect(offsets).toEqual([mid + 24]);
    expect(clock.pending).toBe(true);
  });

  it("does not start a rise for a sub-pixel distance", () => {
    const applyOffset = vi.fn();
    const clock = createFrameClock();
    const rise = createContentRise({
      applyOffset,
      requestAnimationFrame: (callback) => clock.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => clock.cancelAnimationFrame(handle),
      prefersReducedMotion: () => false,
    });

    rise.start(0.4);
    expect(applyOffset).not.toHaveBeenCalled();
    expect(clock.pending).toBe(false);
  });

  it("skips rise when reduced motion is requested", () => {
    const applyOffset = vi.fn();
    const clock = createFrameClock();
    const rise = createContentRise({
      applyOffset,
      requestAnimationFrame: (callback) => clock.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => clock.cancelAnimationFrame(handle),
      prefersReducedMotion: () => true,
    });

    rise.start(60);
    expect(applyOffset).not.toHaveBeenCalled();
    expect(clock.pending).toBe(false);
  });

  it("clears the offset when cancelled", () => {
    const offsets: number[] = [];
    const clock = createFrameClock();
    const rise = createContentRise({
      applyOffset: (offset) => {
        offsets.push(offset);
      },
      requestAnimationFrame: (callback) => clock.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => clock.cancelAnimationFrame(handle),
      prefersReducedMotion: () => false,
    });

    rise.start(60);
    rise.cancel();
    expect(offsets.at(-1)).toBe(0);
    expect(clock.pending).toBe(false);
  });
});
