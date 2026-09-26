import { describe, expect, it } from "vitest";
import type { Transform } from "@dnd-kit/utilities";
import { resolveSortableInlineItemStyle } from "./sortable-inline-item-style";

const SLIDE: Transform = { x: 48, y: 0, scaleX: 1, scaleY: 1 };
const TRANSITION = "transform 200ms ease";

describe("resolveSortableInlineItemStyle", () => {
  it("keeps an external tab row static and faintly visible while dragging", () => {
    const dragged = resolveSortableInlineItemStyle({
      animateReorder: false,
      externalDndContext: true,
      isDragging: true,
      isActiveId: true,
      transform: SLIDE,
      transition: TRANSITION,
    });
    const neighbor = resolveSortableInlineItemStyle({
      animateReorder: false,
      externalDndContext: true,
      isDragging: false,
      isActiveId: false,
      transform: SLIDE,
      transition: TRANSITION,
    });

    expect(dragged).toEqual({
      transform: undefined,
      transition: TRANSITION,
      opacity: 0.3,
      zIndex: 1000,
    });
    expect(neighbor).toEqual({
      transform: undefined,
      transition: TRANSITION,
      opacity: 1,
      zIndex: 1,
    });
  });

  it("hides the dragged external tab and lets neighbors slide into the gap", () => {
    const dragged = resolveSortableInlineItemStyle({
      animateReorder: true,
      externalDndContext: true,
      isDragging: true,
      isActiveId: true,
      transform: SLIDE,
      transition: TRANSITION,
    });
    const neighbor = resolveSortableInlineItemStyle({
      animateReorder: true,
      externalDndContext: true,
      isDragging: false,
      isActiveId: false,
      transform: SLIDE,
      transition: TRANSITION,
    });

    expect(dragged).toEqual({
      transform: undefined,
      transition: undefined,
      opacity: 0,
      zIndex: 1000,
    });
    expect(neighbor.transform).toContain("48");
    expect(neighbor.opacity).toBe(1);
    expect(neighbor.transition).toBe(TRANSITION);
  });
});
