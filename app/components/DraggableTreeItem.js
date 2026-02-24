// DraggableTreeItem.js

import React, { useState, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import Box from '@mui/material/Box';
import { IconButton, Tooltip } from '@mui/material';
import { Star } from '@mui/icons-material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { updateStarred } from './memoryData';
import AddIcon from '@mui/icons-material/Add';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

const ITEM_TYPE = 'TREE_ITEM';

const DraggableTreeItem = ({
  item,
  children,
  onDropUpdate,
  onSelectItem,
  onCreateNewChild,
  onConfirmDialogBox,
  onDeleteItem,
  onShowMessage,
  onReIndexMemoryKeysFromId,
  onPromoteToParentList,
  onSingleListView,
  onSetAsMemoryList,
  //expandedItemId,
 // setExpandedItemId,
}) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [itemSelectedId, setItemSelectedId] = useState(null);

  // console.log(item.starred);
  const [{ isDragging: dragActive }, drag] = useDrag({
    type: ITEM_TYPE,
    item: () => {
      setIsDragging(true);
      return { id: item.id, parent_id: item.parent_id };
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    end: () => setIsDragging(false),
  });

  const resetParentIdOnLeftDrop = async (draggedItem) => {
    await onDropUpdate(draggedItem.id, null); // Set parent_id to null
  };

  const [, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (draggedItem, monitor) => {
      if (draggedItem.id === item.id) return;

      const didDrop = monitor.didDrop(); // true if a nested drop already handled it
      if (didDrop) return;

      const dropOffset = monitor.getDifferenceFromInitialOffset();

      if (dropOffset && dropOffset.x < -100) {
        // Only reset if the item was dropped well outside (not on another node)
        console.log('Resetting parent_id to null due to leftward drop');
        alert('resetParentIdOnLeftDrop');
        resetParentIdOnLeftDrop(draggedItem);
      } else {
        console.log("onDropUpdate: draggedItem.id: ", draggedItem.id, " item.id: ", item.id);
//        if(draggedItem.parent_id != null)
 //       {
          onDropUpdate(draggedItem.id, item.id);
 //       }else{
 //         onShowMessage("You can't drag & drop a parent Memory List.", "info");
 //       }
        
      }
    }
    ,
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


const checkReIndexParentId = (indexId, parent_id) => {
  if(parent_id == null){
    onShowMessage("You can't re-index the memory_key values for a parent Memory Lists", "warning");
  }
  else{
    onReIndexMemoryKeysFromId(indexId);
  }
  
}

  // const handleExpandChange = () => {
  //   if (item && expandedItemId !== null) {
  //     if (expandedItemId === item.id) {
  //       setExpandedItemId(null); // Collapse if the item is already expanded
  //     } else {
  //       setExpandedItemId(item.id); // Expand the selected item
  //     }
  //   }
  // };

  const getSubItemCount = (item) => {
    // Instead of this
   // return item.children ? item.children.length : 0;

   // Now using
   return item.child_count;
  };

  //const item.child_count

  // console.log("item id: ", item.id);

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
            paddingLeft: isDragging ? '200px' : '8px', // Expand padding when dragging
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* <Tooltip title={item.name} arrow> */}
            <Box
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexGrow: 1, // Allow this box to take up remaining space
              }}
            >{item.name} {isDragging && "Dragging"}{' '}{isHovered && <> [ {getSubItemCount(item)} ]</>}</Box>
          {/* </Tooltip> */}
          {isHovered && (
            <div>
              <Tooltip title="Star List">
                <IconButton
                  onClick={(e) => {
                    const toogle = !item.starred;
                    updateStarred(item.id, toogle);
                    //   console.log('toggle star item:', toogle);
                    e.stopPropagation();
                  }}
                >
                  {item.starred ? <Star /> : <StarBorderIcon />}
                </IconButton>
              </Tooltip>
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
            </div>
          )}
        </Box>
      }
      style={{
        opacity: dragActive ? 0.5 : 1,
      }}
    >
      {/* 1) if we have loaded children, render them */}
      {Array.isArray(item.children) && item.children.length > 0 ? (
        children
      ) : null}

      {/* 2) if not loaded yet but child_count says it has kids, render a placeholder */}
      {item.children === undefined && (item.child_count ?? 0) > 0 ? (
        <TreeItem
          itemId={`${item.id}__placeholder`}
          label={item.isLoadingChildren ? 'Loading…' : 'Expand to load…'}
          disabled
        />
      ) : null}

      {/* 3) if loaded but empty, render nothing */}
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
  <MenuItem onClick={() => { handleClose(); onCreateNewChild(item.id); }}>
    Add Child
  </MenuItem>
  <MenuItem onClick={() => { handleClose(); updateStarred(item.id, !item.starred); }}>
    {item.starred ? 'Unstar' : 'Star'}
  </MenuItem>
    <MenuItem onClick={() => { handleClose(); onSetAsMemoryList(item.id, item.memory_list_key != null ? false : true); }}>
    {item.memory_list_key != null ? 'Un Set as Memory List' : 'Set as Memory List'}
  </MenuItem>
  <MenuItem onClick={() => { onConfirmDialogBox(item.id); handleClose(); console.log('Insert 100 Items', item.id); }}>
    Insert 10 Items
  </MenuItem>
  <MenuItem onClick={() => { handleClose(); checkReIndexParentId(item.id, item.parent_id); }}>
    Re-Index from this Item
  </MenuItem>
  <MenuItem onClick={() => { handleClose(); onPromoteToParentList(item.id); }}>
    Promote to parent List
  </MenuItem>
  <MenuItem onClick={() => { handleClose(); onSingleListView(item.id); }}>
    Single List View
  </MenuItem>
    <MenuItem onClick={() => { handleClose(); onDeleteItem(item.id); }}>
    Delete Item
  </MenuItem>
</Menu>
</>
  );
}

export default DraggableTreeItem;
