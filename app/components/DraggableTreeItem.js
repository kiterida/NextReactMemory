import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import Box from '@mui/material/Box';
import { IconButton, Tooltip } from '@mui/material';
import {
  DragIndicator as DragIndicatorIcon,
  Link as LinkIcon,
  Lock as LockIcon,
  Star,
} from '@mui/icons-material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import {
  MEMORY_ITEM_TYPES,
  updateMemoryItemType,
  updateStarred,
} from './memoryData';
import AddIcon from '@mui/icons-material/Add';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

export const TREE_ITEM_NEST_DND_TYPE = 'TREE_ITEM_NEST';
export const TREE_ITEM_REORDER_DND_TYPE = 'TREE_ITEM_REORDER';

const ITEM_TYPE_OPTIONS = Object.values(MEMORY_ITEM_TYPES);

const DraggableTreeItem = ({
  item,
  children,
  onDropUpdate,
  onSelectItem,
  onCreateNewChild,
  onLinkExistingItemHere,
  onConfirmDialogBox,
  onDeleteItem,
  onShowMessage,
  onReIndexMemoryKeysFromId,
  onPromoteToParentList,
  onSingleListView,
  onSetAsMemoryList,
  onToggleListLock,
  onReorderHover,
  onReorderDrop,
  onClearReorderHover,
  reorderDropIndicator,
}) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isItemTypeDialogOpen, setIsItemTypeDialogOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState(item.item_type ?? MEMORY_ITEM_TYPES.GROUP);
  const [isSavingItemType, setIsSavingItemType] = useState(false);
  const rowRef = useRef(null);

  const isLinkedItem = Boolean(item.is_linked);
  const isLockedList = item.item_type === MEMORY_ITEM_TYPES.LIST && Boolean(item.is_locked);
  const canStartNestDrag = !isLinkedItem && !item.is_structure_locked;
  const canStartReorderDrag = !isLinkedItem && Boolean(item.can_reorder);
  const canAcceptNestedChildren = !isLinkedItem && !Boolean(item.blocks_child_structure);
  const canCreateChild = !isLinkedItem && !Boolean(item.blocks_child_structure);
  const showReorderHandle = isHovered || reorderDropIndicator?.draggedItemId === item.id;
  const showDropBefore =
    reorderDropIndicator?.draggedItemId !== item.id &&
    reorderDropIndicator?.targetItemId === item.id &&
    reorderDropIndicator?.placement === 'before';
  const showDropAfter =
    reorderDropIndicator?.draggedItemId !== item.id &&
    reorderDropIndicator?.targetItemId === item.id &&
    reorderDropIndicator?.placement === 'after';

  useEffect(() => {
    setSelectedItemType(item.item_type ?? MEMORY_ITEM_TYPES.GROUP);
  }, [item.item_type]);

  const reorderHandleTitle = useMemo(() => {
    if (isLinkedItem) {
      return 'Linked rows cannot be reordered here.';
    }

    if (item.parent_is_locked) {
      return 'This list is locked. Reordering is disabled.';
    }

    if (!item.can_reorder) {
      return 'Reordering is only available between siblings in an unlocked parent.';
    }

    return 'Drag to reorder siblings';
  }, [isLinkedItem, item.parent_is_locked, item.can_reorder]);

  const [{ isDragging: isNestDragging }, dragRow, nestPreview] = useDrag({
    type: TREE_ITEM_NEST_DND_TYPE,
    canDrag: () => canStartNestDrag,
    item: () => ({
      id: item.id,
      parent_id: item.tree_parent_id ?? null,
      source_item_id: item.source_item_id ?? item.id,
    }),
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    end: () => {
      onClearReorderHover?.();
    },
  });

  const [{ isDragging: isReorderDragging }, dragHandle] = useDrag({
    type: TREE_ITEM_REORDER_DND_TYPE,
    canDrag: () => canStartReorderDrag,
    item: () => ({
      id: item.id,
      parent_id: item.tree_parent_id ?? null,
      source_item_id: item.source_item_id ?? item.id,
    }),
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    end: () => {
      onClearReorderHover?.();
    },
  });

  const [{ isOver, currentDragType, canDrop }, drop] = useDrop({
    accept: [TREE_ITEM_NEST_DND_TYPE, TREE_ITEM_REORDER_DND_TYPE],
    canDrop: (draggedItem, monitor) => {
      const dragType = monitor.getItemType();

      if (dragType === TREE_ITEM_REORDER_DND_TYPE) {
        return (
          !isLinkedItem &&
          !draggedItem?.is_linked &&
          draggedItem?.id !== item.id &&
          String(draggedItem?.parent_id ?? '') === String(item.tree_parent_id ?? '')
        );
      }

      return (
        canAcceptNestedChildren &&
        draggedItem?.id !== item.id &&
        String(draggedItem?.parent_id ?? '') !== String(item.id)
      );
    },
    hover: (draggedItem, monitor) => {
      if (monitor.getItemType() !== TREE_ITEM_REORDER_DND_TYPE || !rowRef.current) {
        return;
      }

      if (
        draggedItem?.id === item.id ||
        String(draggedItem?.parent_id ?? '') !== String(item.tree_parent_id ?? '')
      ) {
        onClearReorderHover?.();
        return;
      }

      const hoverBoundingRect = rowRef.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();

      if (!clientOffset) {
        return;
      }

      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const placement = hoverClientY < hoverMiddleY ? 'before' : 'after';
      onReorderHover?.(draggedItem.id, item.id, placement);
    },
    drop: (draggedItem, monitor) => {
      if (draggedItem?.id === item.id || monitor.didDrop()) {
        return;
      }

      const dragType = monitor.getItemType();

      if (dragType === TREE_ITEM_REORDER_DND_TYPE) {
        const indicator = reorderDropIndicator;
        const placement = indicator?.targetItemId === item.id ? indicator.placement : 'before';
        onReorderDrop?.(draggedItem.id, item.id, placement);
        return;
      }

      const dropOffset = monitor.getDifferenceFromInitialOffset();

      if (dropOffset && dropOffset.x < -100) {
        onDropUpdate(draggedItem.id, null);
      } else if (String(draggedItem.parent_id ?? '') !== String(item.id)) {
        onDropUpdate(draggedItem.id, item.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      currentDragType: monitor.getItemType(),
      canDrop: monitor.canDrop(),
    }),
  });

  const handleContextMenu = (event) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
          }
        : null
    );
  };

  const handleClose = () => {
    setContextMenu(null);
  };

  const openItemTypeDialog = () => {
    setSelectedItemType(item.item_type ?? MEMORY_ITEM_TYPES.GROUP);
    setIsItemTypeDialogOpen(true);
  };

  const closeItemTypeDialog = () => {
    if (isSavingItemType) return;
    setIsItemTypeDialogOpen(false);
  };

  const handleSaveItemType = async () => {
    try {
      setIsSavingItemType(true);
      await updateMemoryItemType(item.source_item_id ?? item.id, selectedItemType);
      setIsItemTypeDialogOpen(false);
      onShowMessage(`Updated item type to "${selectedItemType}".`, 'success');
      window.dispatchEvent(
        new CustomEvent('memory-item-type-updated', {
          detail: { id: String(item.source_item_id ?? item.id) },
        })
      );
    } catch (error) {
      console.error('Error updating item type:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      onShowMessage(`Failed to update item type: ${message}`, 'error');
    } finally {
      setIsSavingItemType(false);
    }
  };

  const checkReIndexParentId = (indexId, parentId) => {
    if (parentId == null) {
      onShowMessage("You can't re-index the memory_key values for a parent Memory Lists", 'warning');
    } else {
      onReIndexMemoryKeysFromId(indexId);
    }
  };

  const getSubItemCount = (currentItem) => currentItem.child_count;

  const showNestDropState = isOver && canDrop && currentDragType === TREE_ITEM_NEST_DND_TYPE;
  const treeOpacity = isNestDragging || isReorderDragging ? 0.45 : 1;

  return (
    <>
      <TreeItem
        itemId={String(item.id)}
        id={`tree-item-${item.id}`}
        label={
          <Box
            ref={(node) => {
              rowRef.current = node;
              drop(node);
              nestPreview(node);
            }}
            onClick={(event) => onSelectItem(event, item)}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
              setIsHovered(false);
              if (reorderDropIndicator?.targetItemId === item.id) {
                onClearReorderHover?.();
              }
            }}
            sx={(theme) => ({
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              minHeight: '40px',
              paddingRight: '104px',
              paddingLeft: '8px',
              borderRadius: 1,
              backgroundColor: showNestDropState ? theme.palette.action.hover : 'transparent',
              outline: showNestDropState ? `1px solid ${theme.palette.primary.main}` : 'none',
              transition: 'background-color 120ms ease, outline-color 120ms ease',
              opacity: treeOpacity,
            })}
          >
            {showDropBefore ? (
              <Box
                sx={(theme) => ({
                  position: 'absolute',
                  left: 4,
                  right: 4,
                  top: 2,
                  height: 2,
                  borderRadius: 999,
                  backgroundColor: theme.palette.primary.main,
                })}
              />
            ) : null}
            {showDropAfter ? (
              <Box
                sx={(theme) => ({
                  position: 'absolute',
                  left: 4,
                  right: 4,
                  bottom: 2,
                  height: 2,
                  borderRadius: 999,
                  backgroundColor: theme.palette.primary.main,
                })}
              />
            ) : null}

            <Box
              ref={(node) => {
                if (node) {
                  dragRow(node);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexGrow: 1,
                minWidth: 0,
                cursor: canStartNestDrag ? 'grab' : 'default',
              }}
            >
              {isLinkedItem ? (
                <Tooltip title="Linked item">
                  <LinkIcon fontSize="small" color="action" />
                </Tooltip>
              ) : null}
              {isLockedList ? (
                <Tooltip title="This list is locked. Reordering is disabled.">
                  <LockIcon fontSize="small" color="action" />
                </Tooltip>
              ) : null}
              <Box
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name}
                {isHovered ? <> [ {getSubItemCount(item)} ]</> : null}
              </Box>
            </Box>

            <Box
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                opacity: isHovered || isReorderDragging ? 1 : 0,
                pointerEvents: isHovered || isReorderDragging ? 'auto' : 'none',
                transition: 'opacity 120ms ease',
                bgcolor: 'background.paper',
                borderRadius: 999,
                boxShadow: isHovered || isReorderDragging ? 1 : 0,
                px: 0.25,
              }}
            >
              <Tooltip title={reorderHandleTitle}>
                <span>
                  <IconButton
                    ref={(node) => {
                      if (node) {
                        dragHandle(node);
                      }
                    }}
                    size="small"
                    disabled={!canStartReorderDrag}
                    onClick={(event) => event.stopPropagation()}
                    sx={{
                      opacity: showReorderHandle ? 1 : 0,
                      visibility: showReorderHandle ? 'visible' : 'hidden',
                    }}
                  >
                    <DragIndicatorIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={isLinkedItem ? 'Star source item' : 'Star List'}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    const toggle = !item.starred;
                    updateStarred(item.source_item_id ?? item.id, toggle);
                    e.stopPropagation();
                  }}
                >
                  {item.starred ? <Star fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>

              {!isLinkedItem ? (
                <Tooltip title={canCreateChild ? 'Add Child Item' : 'This list is locked. Structural changes are disabled.'}>
                  <span>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateNewChild(item.id);
                      }}
                      color="primary"
                      size="small"
                      disabled={!canCreateChild}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
            </Box>
          </Box>
        }
        style={{
          opacity: treeOpacity,
        }}
      >
        {Array.isArray(item.children) && item.children.length > 0 ? children : null}

        {item.children === undefined && (item.child_count ?? 0) > 0 ? (
          <TreeItem
            itemId={`${item.id}__placeholder`}
            label={item.isLoadingChildren ? 'Loading...' : 'Expand to load...'}
            disabled
          />
        ) : null}
      </TreeItem>

      <Menu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {!isLinkedItem ? (
          <MenuItem disabled={!canCreateChild} onClick={() => { handleClose(); onCreateNewChild(item.id); }}>
            Add Child
          </MenuItem>
        ) : null}
        {onLinkExistingItemHere ? (
          <MenuItem disabled={!canAcceptNestedChildren} onClick={() => { handleClose(); onLinkExistingItemHere(item.id); }}>
            Link existing item here
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => { handleClose(); updateStarred(item.source_item_id ?? item.id, !item.starred); }}>
          {item.starred ? 'Unstar' : 'Star'}
        </MenuItem>
        {!isLinkedItem ? (
          <MenuItem onClick={() => { handleClose(); onSetAsMemoryList(item.id, item.item_type === 'list' ? false : true); }}>
            {item.item_type === 'list' ? 'Un Set as Memory List' : 'Set as Memory List'}
          </MenuItem>
        ) : null}
        {!isLinkedItem && item.item_type === MEMORY_ITEM_TYPES.LIST ? (
          <MenuItem onClick={() => { handleClose(); onToggleListLock(item, !item.is_locked); }}>
            {item.is_locked ? 'Unlock List' : 'Lock List'}
          </MenuItem>
        ) : null}
        {!isLinkedItem ? (
          <MenuItem disabled={!canCreateChild} onClick={() => { onConfirmDialogBox(item.id); handleClose(); }}>
            Insert 10 Items
          </MenuItem>
        ) : null}
        {!isLinkedItem ? (
          <MenuItem onClick={() => { handleClose(); checkReIndexParentId(item.source_item_id ?? item.id, item.parent_id); }}>
            Re-Index from this Item
          </MenuItem>
        ) : null}
        {!isLinkedItem ? (
          <MenuItem onClick={() => { handleClose(); onPromoteToParentList(item.id); }}>
            Promote to parent List
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => { handleClose(); onSingleListView(item.id); }}>
          Single List View
        </MenuItem>
        {!isLinkedItem ? (
          <MenuItem onClick={() => { handleClose(); openItemTypeDialog(); }}>
            Change Item Type
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => { handleClose(); onDeleteItem(item.id); }}>
          {isLinkedItem ? 'Remove Link' : 'Delete Item'}
        </MenuItem>
      </Menu>

      <Dialog open={isItemTypeDialogOpen} onClose={closeItemTypeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Change Item Type</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current item type: {item.item_type ?? 'unknown'}
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id={`item-type-label-${item.id}`}>Item Type</InputLabel>
            <Select
              labelId={`item-type-label-${item.id}`}
              value={selectedItemType}
              label="Item Type"
              onChange={(event) => setSelectedItemType(event.target.value)}
              disabled={isSavingItemType}
            >
              {ITEM_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeItemTypeDialog} disabled={isSavingItemType}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveItemType}
            variant="contained"
            disabled={isSavingItemType || selectedItemType === (item.item_type ?? MEMORY_ITEM_TYPES.GROUP)}
            startIcon={isSavingItemType ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DraggableTreeItem;
