"use client";

import { type ReactNode, type CSSProperties } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Lista ordenável por arrastar (drag-and-drop), reutilizável. Funciona com mouse,
 * touch (iPhone) e teclado. Substitui as setas ↑↓ de reordenar em todo o app.
 *
 * Uso: o `render` recebe o item + um "bag" — espalhe `handleProps` na alça (botão
 * de arrastar), `setNodeRef`/`style` no contêiner da linha. O `onReorder` recebe a
 * nova ordem (já aplicada com arrayMove); persista/atualize estado lá.
 */
export type SortableRenderBag = {
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties;
  handleProps: Record<string, unknown>;
  isDragging: boolean;
};

function SortableItem({ id, render }: { id: string; render: (bag: SortableRenderBag) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return <>{render({ setNodeRef, style, handleProps: { ...attributes, ...listeners }, isDragging })}</>;
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  className,
  render,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (next: T[]) => void;
  className?: string;
  render: (item: T, bag: SortableRenderBag) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => getId(i) === active.id);
    const newIndex = items.findIndex((i) => getId(i) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableItem key={getId(item)} id={getId(item)} render={(bag) => render(item, bag)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
