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
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useDrag, useDrop } from 'react-dnd';
import TodoItemDialog from './TodoItemDialog';
import {
  createTodoItem,
  createTodoTag,
  deleteTodoItem,
  getTodoListWithItemsAndTags,
  reorderTodoItems,
  updateTodoItem,
} from './todoListQueries';
import {
  formatDueDateLabel,
  getPriorityChipColor,
  getTodoTagChipSx,
  moveTodoItem,
  sortTodoItems,
  sortTodoTags,
} from './todoListUtils';

const DRAG_TYPE = 'TODO_ITEM';
const FILTER_OPTIONS = {
  active: 'active',
  completed: 'completed',
  all: 'all',
};
const ALL_TAG_FILTER = 'all';

function TodoDraggableRow({
  item,
  textLines,
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
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <Typography
                  sx={{
                    textDecoration: item.is_completed ? 'line-through' : 'none',
                    color: item.is_completed ? 'text.secondary' : 'text.primary',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: textLines,
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

              {item.tags?.length ? (
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  {item.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      size="small"
                      label={tag.name}
                      variant="outlined"
                      sx={getTodoTagChipSx(tag.color, 'outlined')}
                    />
                  ))}
                </Stack>
              ) : null}
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
  const textLines = Math.max(1, Number(widget?.config?.text_lines) || 2);
  const [todoList, setTodoList] = React.useState(null);
  const [viewMode, setViewMode] = React.useState(FILTER_OPTIONS.active);
  const [tagFilterId, setTagFilterId] = React.useState(ALL_TAG_FILTER);
  const [loading, setLoading] = React.useState(Boolean(todoListId));
  const [saving, setSaving] = React.useState(false);
  const [tagSaving, setTagSaving] = React.useState(false);
  const [deleteSaving, setDeleteSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const [createItemDefaults, setCreateItemDefaults] = React.useState(null);
  const [deletingItem, setDeletingItem] = React.useState(null);
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
      const data = await getTodoListWithItemsAndTags(todoListId);
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

  React.useEffect(() => {
    if (tagFilterId === ALL_TAG_FILTER) {
      return;
    }

    const hasSelectedTag = (todoList?.tags ?? []).some((tag) => String(tag.id) === String(tagFilterId));
    if (!hasSelectedTag) {
      setTagFilterId(ALL_TAG_FILTER);
    }
  }, [tagFilterId, todoList?.tags]);

  const handleCreateTag = async (tagValues) => {
    if (!todoListId) {
      throw new Error('No todo list is linked to this widget.');
    }

    setTagSaving(true);

    try {
      const createdTag = await createTodoTag(todoListId, tagValues.name, tagValues.color);
      setTodoList((prev) => ({
        ...prev,
        tags: sortTodoTags([...(prev?.tags ?? []), createdTag]),
      }));
      return createdTag;
    } finally {
      setTagSaving(false);
    }
  };

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
      setCreateItemDefaults(null);
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

  const handleDeleteItem = (item) => {
    setDeletingItem(item);
  };

  const handleCancelDelete = () => {
    if (deleteSaving) {
      return;
    }

    setDeletingItem(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) {
      return;
    }

    setDeleteSaving(true);

    try {
      await deleteTodoItem(deletingItem.id);
      setTodoList((prev) => ({
        ...prev,
        items: sortTodoItems((prev?.items ?? []).filter((entry) => entry.id !== deletingItem.id)),
      }));
      setDeletingItem(null);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete the item.');
    } finally {
      setDeleteSaving(false);
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
    const selectedTag = (todoList?.tags ?? []).find((tag) => String(tag.id) === String(tagFilterId));

    setEditingItem(null);
    setCreateItemDefaults(
      selectedTag
        ? {
            tags: [selectedTag],
          }
        : null
    );
    setItemDialogOpen(true);
  };

  const openEditDialog = (item) => {
    setCreateItemDefaults(null);
    setEditingItem(item);
    setItemDialogOpen(true);
  };

  const items = sortTodoItems(todoList?.items ?? []);
  const visibleItems = items.filter((item) => {
    if (viewMode === FILTER_OPTIONS.active && item.is_completed) {
      return false;
    }

    if (viewMode === FILTER_OPTIONS.completed && !item.is_completed) {
      return false;
    }

    if (tagFilterId !== ALL_TAG_FILTER) {
      return (item.tags ?? []).some((tag) => String(tag.id) === String(tagFilterId));
    }

    return true;
  });

  const emptyStateMessage = (() => {
    if (!todoList) {
      return '';
    }

    if (items.length === 0) {
      return 'No items yet. Use Add to create the first task.';
    }

    if (tagFilterId !== ALL_TAG_FILTER) {
      return 'No items match the selected tag.';
    }

    if (viewMode === FILTER_OPTIONS.active) {
      return 'No active items.';
    }

    if (viewMode === FILTER_OPTIONS.completed) {
      return 'No completed items yet.';
    }

    return 'No items to display.';
  })();

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

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_, nextValue) => {
                if (nextValue) {
                  setViewMode(nextValue);
                }
              }}
              aria-label="Filter to do items"
            >
              <ToggleButton value={FILTER_OPTIONS.active}>Active</ToggleButton>
              <ToggleButton value={FILTER_OPTIONS.completed}>Completed</ToggleButton>
              <ToggleButton value={FILTER_OPTIONS.all}>All</ToggleButton>
            </ToggleButtonGroup>

            <TextField
              select
              size="small"
              label="Tag"
              value={tagFilterId}
              onChange={(event) => setTagFilterId(event.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value={ALL_TAG_FILTER}>All</MenuItem>
              {(todoList?.tags ?? []).map((tag) => (
                <MenuItem key={tag.id} value={String(tag.id)}>
                  {tag.name}
                </MenuItem>
              ))}
            </TextField>

            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateDialog}>
              Add
            </Button>
          </Stack>
        </Stack>

        {todoList?.tags?.length ? (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {todoList.tags.map((tag) => (
              <Chip
                key={tag.id}
                size="small"
                label={tag.name}
                variant={String(tag.id) === String(tagFilterId) ? 'filled' : 'outlined'}
                onClick={() => setTagFilterId((prev) => (String(prev) === String(tag.id) ? ALL_TAG_FILTER : String(tag.id)))}
                sx={getTodoTagChipSx(tag.color, String(tag.id) === String(tagFilterId) ? 'filled' : 'outlined')}
              />
            ))}
          </Stack>
        ) : null}

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

        {tagSaving ? <Alert severity="info">Saving new tag...</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : null}

        {!loading && !todoListId ? (
          <Alert severity="info">Configure this widget to link a to do list.</Alert>
        ) : null}

        {!loading && todoListId && !todoList ? (
          <Alert severity="warning">The linked to do list could not be found.</Alert>
        ) : null}

        {!loading && todoList && visibleItems.length === 0 ? (
          <Alert severity="info">{emptyStateMessage}</Alert>
        ) : null}

        {!loading && todoList && visibleItems.length > 0 ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              pr: 0.5,
            }}
          >
            <List disablePadding>
              {visibleItems.map((item) => (
                <TodoDraggableRow
                  key={item.id}
                  item={item}
                  textLines={textLines}
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
        initialValues={editingItem || createItemDefaults}
        todoTags={todoList?.tags ?? []}
        saving={saving}
        onClose={() => {
          if (saving) {
            return;
          }
          setItemDialogOpen(false);
          setEditingItem(null);
          setCreateItemDefaults(null);
        }}
        onSave={editingItem ? handleUpdateItem : handleCreateItem}
        onCreateTag={handleCreateTag}
      />

      <Dialog open={Boolean(deletingItem)} onClose={deleteSaving ? undefined : handleCancelDelete} maxWidth="xs" fullWidth>
        <DialogTitle>Delete To Do Item?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            {deletingItem
              ? `Are you sure you want to permanently delete "${deletingItem.name}" from this to do list?`
              : 'Are you sure you want to permanently delete this item from this to do list?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} disabled={deleteSaving}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete} disabled={deleteSaving}>
            {deleteSaving ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
