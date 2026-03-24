'use client';

import * as React from 'react';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LinkIcon from '@mui/icons-material/Link';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
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
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useDrag, useDragLayer, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import TodoItemDialog from './TodoItemDialog';
import TodoTagManagerDialog from './TodoTagManagerDialog';
import {
  createTodoItem,
  createTodoTag,
  deleteTodoTag,
  deleteTodoItem,
  getTodoListWithItemsAndTags,
  reorderTodoItems,
  updateTodoTag,
  updateTodoItem,
} from './todoListQueries';
import {
  formatDueDateLabel,
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

function getTodoItemRowSx(priority, isCompleted) {
  return (theme) => {
    const paletteByPriority = {
      Urgent: {
        background: theme.palette.error.main,
        border: theme.palette.error.light,
      },
      High: {
        background: theme.palette.warning.main,
        border: theme.palette.warning.light,
      },
      Normal: {
        background: theme.palette.text.primary,
        border: theme.palette.divider,
      },
    };

    const colors = paletteByPriority[priority] ?? paletteByPriority.Normal;

    return {
      backgroundColor:
        priority === 'Normal'
          ? theme.palette.action.hover
          : alpha(colors.background, theme.palette.mode === 'dark' ? 0.22 : 0.1),
      borderColor: colors.border,
      '&:hover': {
        backgroundColor:
          priority === 'Normal'
            ? theme.palette.action.selected
            : alpha(colors.background, theme.palette.mode === 'dark' ? 0.3 : 0.16),
      },
      ...(isCompleted
        ? {
            opacity: 0.8,
          }
        : null),
    };
  };
}

function formatCreatedDateLabel(createdAt) {
  if (!createdAt) {
    return 'Created date unknown';
  }

  const parsedDate = new Date(createdAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Created date unknown';
  }

  return `Created ${parsedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`;
}

function TodoItemRowContent({
  item,
  textLines,
  showMetadata,
  onToggleComplete,
  onDelete,
  interactive = true,
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0.75, sm: 1 }}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      sx={{ width: '100%', minWidth: 0 }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        justifyContent="flex-start"
        useFlexGap
        flexWrap={{ xs: 'wrap', sm: 'nowrap' }}
        sx={{
          minWidth: { sm: 52 },
          alignSelf: { sm: 'center' },
        }}
      >
        <Tooltip title="Drag to reorder within the same priority group">
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              color: 'text.secondary',
              width: 18,
              minWidth: 18,
            }}
            onClick={interactive ? (event) => event.stopPropagation() : undefined}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>
        </Tooltip>

        <Checkbox
          checked={Boolean(item.is_completed)}
          onChange={
            interactive && onToggleComplete
              ? (event) => {
                  event.stopPropagation();
                  onToggleComplete(item, event.target.checked);
                }
              : undefined
          }
          onClick={interactive ? (event) => event.stopPropagation() : undefined}
          disabled={!interactive}
          size="small"
          sx={{
            p: 0.25,
          }}
        />

        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          sx={{
            minWidth: 0,
            display: { xs: 'flex', sm: 'none' },
            flex: 1,
          }}
        >
          {showMetadata ? (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
              {formatCreatedDateLabel(item.created_at)}
            </Typography>
          ) : null}

          {interactive && onDelete ? (
            <Tooltip title="Delete item">
              <IconButton
                size="small"
                color="error"
                sx={{ ml: 'auto', p: 0.25 }}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack spacing={0.75}>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
            sx={{
              minWidth: 0,
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            {showMetadata ? (
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                {formatCreatedDateLabel(item.created_at)}
              </Typography>
            ) : null}
          </Stack>

          <Typography
            sx={{
              textDecoration: item.is_completed ? 'line-through' : 'none',
              color: item.is_completed ? 'text.secondary' : 'text.primary',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: textLines,
              lineHeight: 1.3,
              width: '100%',
              py: 0.25,
            }}
          >
            {item.name}
          </Typography>

          {showMetadata ? (
            <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                {`Due ${formatDueDateLabel(item.due_date)}`}
              </Typography>

              {item.tags?.length
                ? item.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      size="small"
                      label={tag.name}
                      variant="outlined"
                      sx={{
                        ...getTodoTagChipSx(tag.color, 'outlined'),
                        height: 20,
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  ))
                : null}
            </Stack>
          ) : null}
        </Stack>
      </Box>

      {interactive && onDelete ? (
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignSelf: 'center',
            minWidth: 28,
            justifyContent: 'center',
          }}
        >
          <Tooltip title="Delete item">
            <IconButton
              size="small"
              color="error"
              sx={{ p: 0.25 }}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(item);
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}
    </Stack>
  );
}

function TodoItemDragPreview() {
  const { currentOffset, itemType, draggedItem, isDragging } = useDragLayer((monitor) => ({
    currentOffset: monitor.getSourceClientOffset(),
    itemType: monitor.getItemType(),
    draggedItem: monitor.getItem(),
    isDragging: monitor.isDragging(),
  }));

  if (!isDragging || itemType !== DRAG_TYPE || !currentOffset || !draggedItem?.todoItem) {
    return null;
  }

  const { x, y } = currentOffset;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 1500,
        transform: `translate(${x + 12}px, ${y + 12}px)`,
      }}
    >
      <Box
        sx={[
          {
            width: draggedItem.previewWidth ?? 320,
            maxWidth: 'min(420px, calc(100vw - 24px))',
            borderRadius: 2,
            border: '1px solid',
            px: { xs: 1, sm: 1.25 },
            py: { xs: 0.75, sm: 1 },
            boxShadow: 8,
            bgcolor: 'background.paper',
          },
          getTodoItemRowSx(draggedItem.todoItem.priority, draggedItem.todoItem.is_completed),
        ]}
      >
        <TodoItemRowContent
          item={draggedItem.todoItem}
          textLines={draggedItem.textLines}
          showMetadata={draggedItem.showMetadata}
          interactive={false}
        />
      </Box>
    </Box>
  );
}

function TodoDropIndicator({ active = false }) {
  return (
    <Box
      sx={(theme) => ({
        height: 0,
        mx: 1,
        my: active ? 0.75 : 0,
        borderTop: active ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
        borderRadius: 999,
        boxShadow: active ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.16)}` : 'none',
        transition: 'border-color 120ms ease, box-shadow 120ms ease, margin 120ms ease',
      })}
    />
  );
}

function TodoDraggableRow({
  item,
  textLines,
  showMetadata,
  onMove,
  onHoverTarget,
  onDragStart,
  onDragEnd,
  onToggleComplete,
  onDelete,
  onEdit,
  showDropLineBefore,
  showDropLineAfter,
}) {
  const rowRef = React.useRef(null);

  const [, drop] = useDrop({
    accept: DRAG_TYPE,
    hover(draggedItem, monitor) {
      if (!rowRef.current || draggedItem.id === item.id) {
        return;
      }

      if (draggedItem.todoItem?.priority !== item.priority) {
        return;
      }

      const clientOffset = monitor.getClientOffset();
      const bounds = rowRef.current.getBoundingClientRect();
      if (!clientOffset || !bounds.height) {
        return;
      }

      const placement = clientOffset.y < bounds.top + bounds.height / 2 ? 'before' : 'after';
      onHoverTarget(draggedItem.id, item.id, placement);

      if (draggedItem.id !== item.id) {
        onMove(draggedItem.id, item.id, placement);
      }
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: DRAG_TYPE,
    item: () => {
      onDragStart();
      return {
        id: item.id,
        todoItem: item,
        textLines,
        showMetadata,
        previewWidth: rowRef.current?.getBoundingClientRect()?.width,
      };
    },
    end: () => {
      onDragEnd();
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  React.useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  drag(drop(rowRef));

  return (
    <>
      <TodoDropIndicator active={showDropLineBefore} />
      <ListItemButton
        ref={rowRef}
        onClick={() => onEdit(item)}
        sx={[
          {
            borderRadius: 2,
            mb: 1,
            alignItems: 'flex-start',
            opacity: isDragging ? 0.45 : 1,
            border: '1px solid',
            px: { xs: 1, sm: 1.25 },
            py: { xs: 0.75, sm: 1 },
          },
          getTodoItemRowSx(item.priority, item.is_completed),
        ]}
      >
        <TodoItemRowContent
          item={item}
          textLines={textLines}
          showMetadata={showMetadata}
          onToggleComplete={onToggleComplete}
          onDelete={onDelete}
        />
      </ListItemButton>
      <TodoDropIndicator active={showDropLineAfter} />
    </>
  );
}

export default function ToDoListWidget({ widget }) {
  const todoListId = widget?.config?.todo_list_id;
  const textLines = Math.max(1, Number(widget?.config?.text_lines) || 2);
  const [todoList, setTodoList] = React.useState(null);
  const [viewMode, setViewMode] = React.useState(FILTER_OPTIONS.active);
  const [tagFilterId, setTagFilterId] = React.useState(ALL_TAG_FILTER);
  const [showTagChips, setShowTagChips] = React.useState(false);
  const [showItemMetadata, setShowItemMetadata] = React.useState(true);
  const [tagMenuAnchorEl, setTagMenuAnchorEl] = React.useState(null);
  const [loading, setLoading] = React.useState(Boolean(todoListId));
  const [saving, setSaving] = React.useState(false);
  const [tagSaving, setTagSaving] = React.useState(false);
  const [deleteSaving, setDeleteSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [tagManagerOpen, setTagManagerOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const [createItemDefaults, setCreateItemDefaults] = React.useState(null);
  const [deletingItem, setDeletingItem] = React.useState(null);
  const [dropIndicator, setDropIndicator] = React.useState(null);
  const dragSnapshotRef = React.useRef([]);
  const hasPendingReorderRef = React.useRef(false);
  const todoListRef = React.useRef(null);

  React.useEffect(() => {
    todoListRef.current = todoList;
  }, [todoList]);

  const isTagMenuOpen = Boolean(tagMenuAnchorEl);

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

  const handleUpdateTag = async (tag, tagValues) => {
    setTagSaving(true);

    try {
      const updatedTag = await updateTodoTag(tag.id, tagValues);
      setTodoList((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          tags: sortTodoTags((prev.tags ?? []).map((entry) => (entry.id === updatedTag.id ? updatedTag : entry))),
          items: (prev.items ?? []).map((item) => ({
            ...item,
            tags: sortTodoTags((item.tags ?? []).map((entry) => (entry.id === updatedTag.id ? updatedTag : entry))),
            tagIds: (item.tags ?? []).map((entry) => (entry.id === updatedTag.id ? updatedTag.id : entry.id)),
          })),
        };
      });
      return updatedTag;
    } finally {
      setTagSaving(false);
    }
  };

  const handleDeleteTag = async (tag) => {
    setTagSaving(true);

    try {
      await deleteTodoTag(tag.id);
      setTodoList((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          tags: sortTodoTags((prev.tags ?? []).filter((entry) => entry.id !== tag.id)),
          items: (prev.items ?? []).map((item) => {
            const nextTags = sortTodoTags((item.tags ?? []).filter((entry) => entry.id !== tag.id));
            return {
              ...item,
              tags: nextTags,
              tagIds: nextTags.map((entry) => entry.id),
            };
          }),
        };
      });
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

  const handleMoveItem = React.useCallback((draggedItemId, targetItemId, placement = 'before') => {
    setTodoList((prev) => {
      if (!prev) {
        return prev;
      }

      const nextItems = moveTodoItem(prev.items ?? [], draggedItemId, targetItemId, placement);
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

  const handleHoverTarget = React.useCallback((draggedItemId, targetItemId, placement = 'before') => {
    setDropIndicator((prev) => {
      if (
        prev?.draggedItemId === draggedItemId &&
        prev?.targetItemId === targetItemId &&
        prev?.placement === placement
      ) {
        return prev;
      }

      return { draggedItemId, targetItemId, placement };
    });
  }, []);

  const handleDragStart = () => {
    dragSnapshotRef.current = todoList?.items ?? [];
    hasPendingReorderRef.current = false;
    setDropIndicator(null);
  };

  const handleDragEnd = async () => {
    setDropIndicator(null);

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
  const activeItemCount = items.filter((item) => !item.is_completed).length;
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
      <TodoItemDragPreview />
      <Stack spacing={2} sx={{ minHeight: widget?.height > 1 ? 220 : 'auto' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              {(todoList?.name || 'Linked to-do list') + ` (${activeItemCount})`}
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{
              '& .MuiIconButton-root': {
                p: 0.5,
              },
              '& .MuiSvgIcon-root': {
                fontSize: 20,
              },
              '& .MuiTextField-root': {
                minWidth: 110,
              },
              '& .MuiInputBase-root': {
                height: 34,
                fontSize: '0.875rem',
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.8rem',
              },
            }}
          >
            <Tooltip title="Add to do item">
              <span>
                <IconButton size="small" color="primary" onClick={openCreateDialog} aria-label="Add to do item">
                  <AddIcon />
                </IconButton>
              </span>
            </Tooltip>

            <TextField
              select
              size="small"
              label="Status"
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value)}
              sx={{ minWidth: 104 }}
            >
              <MenuItem value={FILTER_OPTIONS.active}>Active</MenuItem>
              <MenuItem value={FILTER_OPTIONS.completed}>Completed</MenuItem>
              <MenuItem value={FILTER_OPTIONS.all}>All</MenuItem>
            </TextField>

            <Tooltip title="Filter by Tag">
              <span>
                <IconButton
                  size="small"
                  color={tagFilterId === ALL_TAG_FILTER ? 'default' : 'primary'}
                  onClick={(event) => setTagMenuAnchorEl(event.currentTarget)}
                  aria-label="Filter by Tag"
                >
                  <LocalOfferOutlinedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={showItemMetadata ? 'Hide item metadata' : 'Show item metadata'}>
              <span>
                <IconButton
                  size="small"
                  color={showItemMetadata ? 'primary' : 'default'}
                  onClick={() => setShowItemMetadata((prev) => !prev)}
                  aria-label={showItemMetadata ? 'Hide item metadata' : 'Show item metadata'}
                >
                  <InfoOutlinedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Menu
              anchorEl={tagMenuAnchorEl}
              open={isTagMenuOpen}
              onClose={() => setTagMenuAnchorEl(null)}
            >
              <MenuItem
                selected={tagFilterId === ALL_TAG_FILTER}
                onClick={() => {
                  setTagFilterId(ALL_TAG_FILTER);
                  setTagMenuAnchorEl(null);
                }}
              >
                All
              </MenuItem>
              {(todoList?.tags ?? []).map((tag) => (
                <MenuItem
                  key={tag.id}
                  selected={String(tag.id) === String(tagFilterId)}
                  onClick={() => {
                    setTagFilterId(String(tag.id));
                    setTagMenuAnchorEl(null);
                  }}
                >
                  {tag.name}
                </MenuItem>
              ))}
            </Menu>

            {todoList?.tags?.length ? (
            <Tooltip title={showTagChips ? 'Hide tags' : 'Show tags'}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => setShowTagChips((prev) => !prev)}
                  aria-label={showTagChips ? 'Hide tags' : 'Show tags'}
                  >
                    {showTagChips ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            <Tooltip title="Manage tags">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => setTagManagerOpen(true)}
                  disabled={!todoListId}
                  aria-label="Manage tags"
                >
                  <LocalOfferOutlinedIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {todoList?.tags?.length && showTagChips ? (
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

        {tagSaving ? <Alert severity="info">Saving tag changes...</Alert> : null}
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
                  showMetadata={showItemMetadata}
                  onMove={handleMoveItem}
                  onHoverTarget={handleHoverTarget}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDeleteItem}
                  onEdit={openEditDialog}
                  showDropLineBefore={
                    dropIndicator?.draggedItemId !== item.id &&
                    dropIndicator?.targetItemId === item.id &&
                    dropIndicator?.placement === 'before'
                  }
                  showDropLineAfter={
                    dropIndicator?.draggedItemId !== item.id &&
                    dropIndicator?.targetItemId === item.id &&
                    dropIndicator?.placement === 'after'
                  }
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

      <TodoTagManagerDialog
        open={tagManagerOpen}
        tags={todoList?.tags ?? []}
        saving={tagSaving}
        onClose={() => {
          if (tagSaving) {
            return;
          }

          setTagManagerOpen(false);
        }}
        onCreateTag={handleCreateTag}
        onUpdateTag={handleUpdateTag}
        onDeleteTag={handleDeleteTag}
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
