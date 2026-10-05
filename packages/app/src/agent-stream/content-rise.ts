export const CONTENT_RISE_TIME_CONSTANT_MS = 110;
export const CONTENT_RISE_SETTLE_EPSILON_PX = 0.5;

export interface ContentRiseHost {
  applyOffset(offset: number): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  prefersReducedMotion(): boolean;
}

export interface ContentRise {
  start(distance: number): void;
  cancel(): void;
  getOffset(): number;
}

export function applyContentRiseTransform(node: unknown, offset: number): void {
  if (!(typeof HTMLElement === "function" && node instanceof HTMLElement)) {
    return;
  }
  node.style.transform = offset === 0 ? "" : `translateY(${offset}px)`;
}

export function createDomContentRise(applyOffset: (offset: number) => void): ContentRise {
  return createContentRise({
    applyOffset,
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
    prefersReducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
}

export function createContentRise(host: ContentRiseHost): ContentRise {
  let offset = 0;
  let frame: number | null = null;
  let lastFrameTime: number | null = null;

  function applyOffset(next: number) {
    offset = next;
    host.applyOffset(next);
  }

  function step(timestamp: number) {
    const previousTime = lastFrameTime;
    lastFrameTime = timestamp;
    const deltaMs = previousTime === null ? 0 : timestamp - previousTime;
    const decay = 1 - Math.exp(-deltaMs / CONTENT_RISE_TIME_CONSTANT_MS);
    const next = offset * (1 - decay);
    if (Math.abs(next) < CONTENT_RISE_SETTLE_EPSILON_PX) {
      frame = null;
      lastFrameTime = null;
      applyOffset(0);
      return;
    }
    applyOffset(next);
    frame = host.requestAnimationFrame(step);
  }

  return {
    start(distance) {
      // A retarget mid-rise just nudges the running offset. Restarting a
      // fixed-duration tween would be position-continuous but velocity-discontinuous.
      if (Math.abs(distance) <= 0.5 || host.prefersReducedMotion()) {
        return;
      }
      applyOffset(offset + distance);
      if (frame === null) {
        frame = host.requestAnimationFrame(step);
      }
    },
    cancel() {
      if (frame !== null) {
        host.cancelAnimationFrame(frame);
        frame = null;
      }
      lastFrameTime = null;
      applyOffset(0);
    },
    getOffset() {
      return offset;
    },
  };
}
