'use client';

import * as React from 'react';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LinkIcon from '@mui/icons-material/Link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useDrag, useDrop } from 'react-dnd';
import TodoItemDialog from './TodoItemDialog';
import {
  createTodoItem,
  deleteTodoItem,
  getTodoListWithItems,
  reorderTodoItems,
  updateTodoItem,
} from './todoListQueries';
import {
  formatDueDateLabel,
  getPriorityChipColor,
  moveTodoItem,
  sortTodoItems,
} from './todoListUtils';

const DRAG_TYPE = 'TODO_ITEM';

function TodoDraggableRow({
  item,
  onMove,
  onDragStart,
  onDragEnd,
  onToggleComplete,
  onDelete,
  onEdit,
}) {
  const rowRef = React.useRef(null);

  const [, drop] = useDrop({
    accept: DRAG_TYPE,
    hover(draggedItem) {
      if (draggedItem.id !== item.id) {
        onMove(draggedItem.id, item.id);
      }
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE,
    item: () => {
      onDragStart();
      return { id: item.id };
    },
    end: () => {
      onDragEnd();
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(rowRef));

  return (
    <ListItemButton
      ref={rowRef}
      onClick={() => onEdit(item)}
      sx={{
        borderRadius: 2,
        mb: 1,
        alignItems: 'stretch',
        opacity: isDragging ? 0.45 : 1,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
        <Tooltip title="Drag to reorder within the same priority group">
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              color: 'text.secondary',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>
        </Tooltip>

        <Checkbox
          checked={Boolean(item.is_completed)}
          onChange={(event) => {
            event.stopPropagation();
            onToggleComplete(item, event.target.checked);
          }}
          onClick={(event) => event.stopPropagation()}
        />

        <ListItemText
          primary={
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography
                sx={{
                  textDecoration: item.is_completed ? 'line-through' : 'none',
                  color: item.is_completed ? 'text.secondary' : 'text.primary',
                }}
              >
                {item.name}
              </Typography>
              <Chip
                size="small"
                label={item.priority}
                color={getPriorityChipColor(item.priority)}
                variant={item.priority === 'Normal' ? 'outlined' : 'filled'}
              />
            </Stack>
          }
          secondary={formatDueDateLabel(item.due_date)}
        />

        <Tooltip title="Delete item">
          <IconButton
            edge="end"
            color="error"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </ListItemButton>
  );
}

export default function ToDoListWidget({ widget }) {
  const todoListId = widget?.config?.todo_list_id;
  const [todoList, setTodoList] = React.useState(null);
  const [loading, setLoading] = React.useState(Boolean(todoListId));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const dragSnapshotRef = React.useRef([]);
  const hasPendingReorderRef = React.useRef(false);
  const todoListRef = React.useRef(null);

  React.useEffect(() => {
    todoListRef.current = todoList;
  }, [todoList]);

  const loadTodoList = React.useCallback(async () => {
    if (!todoListId) {
      setTodoList(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await getTodoListWithItems(todoListId);
      setTodoList(data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load this to do list.');
    } finally {
      setLoading(false);
    }
  }, [todoListId]);

  React.useEffect(() => {
    loadTodoList();
  }, [loadTodoList]);

  const handleCreateItem = async (itemValues) => {
    if (!todoListId) {
      throw new Error('No todo list is linked to this widget.');
    }

    setSaving(true);

    try {
      const createdItem = await createTodoItem(todoListId, itemValues);
      setTodoList((prev) => ({
        ...prev,
        items: sortTodoItems([...(prev?.items ?? []), createdItem]),
      }));
      setItemDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateItem = async (itemValues) => {
    if (!editingItem) {
      return;
    }

    setSaving(true);

    try {
      const updatedItem = await updateTodoItem(editingItem.id, itemValues);
      setTodoList((prev) => ({
        ...prev,
        items: sortTodoItems(
          (prev?.items ?? []).map((item) => (item.id === updatedItem.id ? updatedItem : item))
        ),
      }));
      setItemDialogOpen(false);
      setEditingItem(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (item, checked) => {
    try {
      const updatedItem = await updateTodoItem(item.id, { isCompleted: checked });
      setTodoList((prev) => ({
        ...prev,
        items: sortTodoItems(
          (prev?.items ?? []).map((entry) => (entry.id === updatedItem.id ? updatedItem : entry))
        ),
      }));
    } catch (toggleError) {
      setError(toggleError.message || 'Unable to update the item status.');
    }
  };

  const handleDeleteItem = async (item) => {
    const confirmed = window.confirm(`Delete "${item.name}" from this to do list?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteTodoItem(item.id);
      setTodoList((prev) => ({
        ...prev,
        items: sortTodoItems((prev?.items ?? []).filter((entry) => entry.id !== item.id)),
      }));
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete the item.');
    }
  };

  const handleMoveItem = React.useCallback((draggedItemId, targetItemId) => {
    setTodoList((prev) => {
      if (!prev) {
        return prev;
      }

      const nextItems = moveTodoItem(prev.items ?? [], draggedItemId, targetItemId);
      const hasChanged =
        JSON.stringify(nextItems.map((item) => [item.id, item.item_order])) !==
        JSON.stringify((prev.items ?? []).map((item) => [item.id, item.item_order]));

      if (hasChanged) {
        hasPendingReorderRef.current = true;
      }

      return {
        ...prev,
        items: nextItems,
      };
    });
  }, []);

  const handleDragStart = () => {
    dragSnapshotRef.current = todoList?.items ?? [];
    hasPendingReorderRef.current = false;
  };

  const handleDragEnd = async () => {
    if (!hasPendingReorderRef.current || !todoListId || !todoListRef.current) {
      return;
    }

    try {
      const reorderedItems = await reorderTodoItems(todoListId, todoListRef.current.items);
      setTodoList((prev) => ({
        ...prev,
        items: reorderedItems,
      }));
    } catch (reorderError) {
      setTodoList((prev) => ({
        ...prev,
        items: dragSnapshotRef.current,
      }));
      setError(reorderError.message || 'Unable to save the new item order.');
    } finally {
      hasPendingReorderRef.current = false;
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setItemDialogOpen(true);
  };

  const items = sortTodoItems(todoList?.items ?? []);

  return (
    <>
      <Stack spacing={2} sx={{ minHeight: widget?.height > 1 ? 220 : 'auto' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              {todoList?.name || 'Linked to-do list'}
            </Typography>
          </Box>

          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add
          </Button>
        </Stack>

        {todoList?.memory_item ? (
          <Chip
            icon={<LinkIcon />}
            component={Link}
            clickable
            href={`/singleListView?listId=${todoList.memory_item.id}`}
            label={todoList.memory_item.name || `Memory Item ${todoList.memory_item.id}`}
            sx={{ width: 'fit-content' }}
          />
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : null}

        {!loading && !todoListId ? (
          <Alert severity="info">Configure this widget to link a to do list.</Alert>
        ) : null}

        {!loading && todoListId && !todoList ? (
          <Alert severity="warning">The linked to do list could not be found.</Alert>
        ) : null}

        {!loading && todoList && items.length === 0 ? (
          <Alert severity="info">No items yet. Use Add to create the first task.</Alert>
        ) : null}

        {!loading && todoList && items.length > 0 ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              pr: 0.5,
            }}
          >
            <List disablePadding>
              {items.map((item) => (
                <TodoDraggableRow
                  key={item.id}
                  item={item}
                  onMove={handleMoveItem}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDeleteItem}
                  onEdit={openEditDialog}
                />
              ))}
            </List>
          </Box>
        ) : null}
      </Stack>

      <TodoItemDialog
        open={itemDialogOpen}
        mode={editingItem ? 'edit' : 'create'}
        initialValues={editingItem}
        saving={saving}
        onClose={() => {
          if (saving) {
            return;
          }
          setItemDialogOpen(false);
          setEditingItem(null);
        }}
        onSave={editingItem ? handleUpdateItem : handleCreateItem}
      />
    </>
  );
}
