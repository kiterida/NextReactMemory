'use client';

export const TODO_PRIORITY_OPTIONS = ['Normal', 'High', 'Urgent'];

export const TODO_PRIORITY_RANK = {
  Urgent: 0,
  High: 1,
  Normal: 2,
};

export function sortTodoItems(items = []) {
  return [...items].sort((left, right) => {
    const priorityDiff =
      (TODO_PRIORITY_RANK[left.priority] ?? 99) - (TODO_PRIORITY_RANK[right.priority] ?? 99);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const orderDiff = Number(left.item_order ?? 0) - Number(right.item_order ?? 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    return Number(left.id ?? 0) - Number(right.id ?? 0);
  });
}

export function sortTodoTags(tags = []) {
  return [...tags].sort((left, right) => {
    const orderDiff = Number(left.display_order ?? 0) - Number(right.display_order ?? 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    const nameDiff = String(left.name ?? '').localeCompare(String(right.name ?? ''));
    if (nameDiff !== 0) {
      return nameDiff;
    }

    return Number(left.id ?? 0) - Number(right.id ?? 0);
  });
}

export function moveTodoItem(items, draggedItemId, targetItemId) {
  const orderedItems = sortTodoItems(items);
  const fromIndex = orderedItems.findIndex((item) => item.id === draggedItemId);
  const toIndex = orderedItems.findIndex((item) => item.id === targetItemId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return orderedItems;
  }

  if (orderedItems[fromIndex].priority !== orderedItems[toIndex].priority) {
    return orderedItems;
  }

  const nextItems = [...orderedItems];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);

  const nextOrderById = new Map();
  const groupedByPriority = {
    Urgent: [],
    High: [],
    Normal: [],
  };

  nextItems.forEach((item) => {
    const priorityKey = TODO_PRIORITY_OPTIONS.includes(item.priority) ? item.priority : 'Normal';
    groupedByPriority[priorityKey].push(item);
  });

  Object.values(groupedByPriority).forEach((groupItems) => {
    groupItems.forEach((item, index) => {
      nextOrderById.set(item.id, index);
    });
  });

  return nextItems.map((item) => ({
    ...item,
    item_order: nextOrderById.get(item.id) ?? Number(item.item_order ?? 0),
  }));
}

export function formatDueDateLabel(dueDate) {
  if (!dueDate) {
    return 'No due date';
  }

  const parsedDate = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return dueDate;
  }

  return parsedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getPriorityChipColor(priority) {
  if (priority === 'Urgent') {
    return 'error';
  }

  if (priority === 'High') {
    return 'warning';
  }

  return 'default';
}

export function getTodoTagChipSx(color, variant = 'filled') {
  if (!color) {
    return variant === 'outlined'
      ? undefined
      : {
          bgcolor: 'action.selected',
        };
  }

  return {
    bgcolor: variant === 'outlined' ? 'transparent' : color,
    borderColor: color,
    color: variant === 'outlined' ? color : '#fff',
    '& .MuiChip-deleteIcon': {
      color: variant === 'outlined' ? color : 'rgba(255,255,255,0.7)',
    },
  };
}
