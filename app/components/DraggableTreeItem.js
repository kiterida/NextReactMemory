import React, { useState, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import Box from '@mui/material/Box';
import { IconButton, Tooltip } from '@mui/material';
import { Link as LinkIcon, Star } from '@mui/icons-material';
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

const ITEM_TYPE = 'TREE_ITEM';
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
}) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isItemTypeDialogOpen, setIsItemTypeDialogOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState(item.item_type ?? MEMORY_ITEM_TYPES.GROUP);
  const [isSavingItemType, setIsSavingItemType] = useState(false);

  const isLinkedItem = Boolean(item.is_linked);

  useEffect(() => {
    setSelectedItemType(item.item_type ?? MEMORY_ITEM_TYPES.GROUP);
  }, [item.item_type]);

  const [{ isDragging: dragActive }, drag] = useDrag({
    type: ITEM_TYPE,
    canDrag: () => !isLinkedItem,
    item: () => {
      setIsDragging(true);
      return { id: item.id, parent_id: item.tree_parent_id };
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    end: () => setIsDragging(false),
  });

  const resetParentIdOnLeftDrop = (draggedItem) => {
    onDropUpdate(draggedItem.id, null);
  };

  const [, drop] = useDrop({
    accept: ITEM_TYPE,
    canDrop: () => !isLinkedItem,
    drop: (draggedItem, monitor) => {
      if (draggedItem.id === item.id) return;

      const didDrop = monitor.didDrop();
      if (didDrop) return;

      const dropOffset = monitor.getDifferenceFromInitialOffset();

      if (dropOffset && dropOffset.x < -100) {
        resetParentIdOnLeftDrop(draggedItem);
      } else if (String(draggedItem.parent_id ?? '') !== String(item.id)) {
        onDropUpdate(draggedItem.id, item.id);
      }
    },
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

  return (
    <>
      <TreeItem
        ref={(node) => drag(drop(node))}
        itemId={String(item.id)}
        id={`tree-item-${item.id}`}
        label={
          <Box
            onClick={(event) => onSelectItem(event, item)}
            onContextMenu={handleContextMenu}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              minHeight: '40px',
              paddingRight: '8px',
              paddingLeft: isDragging ? '200px' : '8px',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexGrow: 1,
              }}
            >
              {isLinkedItem ? (
                <Tooltip title="Linked item">
                  <LinkIcon fontSize="small" color="action" />
                </Tooltip>
              ) : null}
              <Box
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name} {isDragging && 'Dragging'} {isHovered && <>[ {getSubItemCount(item)} ]</>}
              </Box>
            </Box>
            {isHovered && (
              <div>
                <Tooltip title={isLinkedItem ? 'Star source item' : 'Star List'}>
                  <IconButton
                    onClick={(e) => {
                      const toggle = !item.starred;
                      updateStarred(item.source_item_id ?? item.id, toggle);
                      e.stopPropagation();
                    }}
                  >
                    {item.starred ? <Star /> : <StarBorderIcon />}
                  </IconButton>
                </Tooltip>
                {!isLinkedItem ? (
                  <Tooltip title="Add Child Item">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateNewChild(item.id);
                      }}
                      color="primary"
                      size="small"
                      sx={{ marginLeft: 'auto' }}
                    >
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </div>
            )}
          </Box>
        }
        style={{
          opacity: dragActive ? 0.5 : 1,
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
          <MenuItem onClick={() => { handleClose(); onCreateNewChild(item.id); }}>
            Add Child
          </MenuItem>
        ) : null}
        {onLinkExistingItemHere ? (
          <MenuItem onClick={() => { handleClose(); onLinkExistingItemHere(item.id); }}>
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
        {!isLinkedItem ? (
          <MenuItem onClick={() => { onConfirmDialogBox(item.id); handleClose(); }}>
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


