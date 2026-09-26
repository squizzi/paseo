import { CSS, type Transform } from "@dnd-kit/utilities";

export interface SortableInlineItemStyleInput {
  animateReorder: boolean;
  externalDndContext: boolean;
  isDragging: boolean;
  isActiveId: boolean;
  transform: Transform | null;
  transition: string | undefined;
}

export interface SortableInlineItemStyle {
  transform: string | undefined;
  transition: string | undefined;
  opacity: number;
  zIndex: number;
}

function computeDragOpacity(input: {
  externalDndContext: boolean;
  isItemDragging: boolean;
  animateReorder: boolean;
}): number {
  if (!input.isItemDragging) {
    return 1;
  }
  if (!input.externalDndContext) {
    return 0.9;
  }
  return input.animateReorder ? 0 : 0.3;
}

export function resolveSortableInlineItemStyle(
  input: SortableInlineItemStyleInput,
): SortableInlineItemStyle {
  const isItemDragging = input.animateReorder
    ? input.isDragging || input.isActiveId
    : input.isDragging;
  const freezeExternalRow = input.externalDndContext && (!input.animateReorder || isItemDragging);
  const scaledTransform =
    input.transform && isItemDragging
      ? { ...input.transform, scaleX: 1, scaleY: 1 }
      : input.transform;
  const baseTransform = freezeExternalRow ? undefined : CSS.Transform.toString(scaledTransform);
  const scaleTransform = !input.externalDndContext && isItemDragging ? "scale(1.01)" : "";
  const combinedTransform = [baseTransform, scaleTransform].filter(Boolean).join(" ");
  return {
    transform: combinedTransform || undefined,
    transition: input.animateReorder && isItemDragging ? undefined : input.transition,
    opacity: computeDragOpacity({
      externalDndContext: input.externalDndContext,
      isItemDragging,
      animateReorder: input.animateReorder,
    }),
    zIndex: isItemDragging ? 1000 : 1,
  };
}
