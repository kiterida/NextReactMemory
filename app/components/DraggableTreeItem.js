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

const ITEM_TYPE = 'TREE_ITEM';

const DraggableTreeItem = ({
  item,
  children,
  onDropUpdate,
  onSelectItem,
  onCreateNewChild,
  //expandedItemId,
 // setExpandedItemId,
}) => {
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
        resetParentIdOnLeftDrop(draggedItem);
      } else {
        console.log("onDropUpdate: draggedItem.id: ", draggedItem.id, " item.id: ", item.id);
        onDropUpdate(draggedItem.id, item.id);
      }
    }
    ,
  });

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
    return item.children ? item.children.length : 0;
  };

  console.log("item id: ", item.id);

  return (
    <TreeItem
      ref={(node) => drag(drop(node))}
      itemId={String(item.id)}
      id={`tree-item-${item.id}`}
      label={
        <Box
          onClick={(event) => onSelectItem(event, item)}
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
          <Tooltip title={item.name} arrow>
            <Box
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexGrow: 1, // Allow this box to take up remaining space
              }}
            >{item.name} {isDragging && "Dragging"}{' '}{isHovered && <> [ {getSubItemCount(item)} ]</>}</Box>
          </Tooltip>
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
      {children}
    </TreeItem>
  );
}

export default DraggableTreeItem;