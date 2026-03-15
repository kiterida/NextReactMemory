'use client';

function findWidgetIndex(widgets, widgetId) {
  return widgets.findIndex((widget) => widget.id === widgetId);
}

export function moveWidgetInList(widgets, draggedWidgetId, targetWidgetId) {
  const sourceIndex = findWidgetIndex(widgets, draggedWidgetId);
  const targetIndex = findWidgetIndex(widgets, targetWidgetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return widgets;
  }

  const nextWidgets = [...widgets];
  const [movedWidget] = nextWidgets.splice(sourceIndex, 1);
  nextWidgets.splice(targetIndex, 0, movedWidget);

  return nextWidgets;
}

export function assignDisplayOrder(widgets) {
  return widgets.map((widget, index) => ({
    ...widget,
    display_order: index,
  }));
}

export function getNextDisplayOrder(widgets) {
  if (!widgets.length) {
    return 0;
  }

  return Math.max(...widgets.map((widget) => Number(widget.display_order ?? 0))) + 1;
}
