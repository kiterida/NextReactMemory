// MemoriesView.tsx

'use client';
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { fetchMemoryTree, updateMemoryItemParent, updateMemoryItem, updateStarred } from './memoryData';
import { supabase } from './supabaseClient';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useTreeViewApiRef } from '@mui/x-tree-view/hooks';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DraggableTreeItem from './DraggableTreeItem';
import { Box, Card, CardContent } from '@mui/material';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import ItemDetailsTab from './ItemDetailsTab';
import CodeSnippet from './CodeSnippet';
import Alert from '@mui/material/Alert';
import Snackbar, { SnackbarCloseReason } from '@mui/material/Snackbar';
import { useSearchParams } from 'next/navigation';

interface MemoriesViewProps {
  filterStarred?: boolean;
  focusId?: string | null; // or just `string` depending on your logic
}

type MemoryItem = {
  id: string;
  name?: string;
  description?: string;
  parent_id?: string | null;
  code_snippet?: string;
  memory_key?: string;
  memory_image?: string;
  starred?: boolean;
};

export interface MemoryTreeItem {
  id: string;
  name?: string;
  description?: string;
  parent_id?: string | null;
  code_snippet?: string;
  memory_key?: string;
  memory_image?: string;
  starred?: boolean;
  // ... add any other fields your items have (like `title`, `starred`, etc.)
  children?: MemoryTreeItem[];
}

const MemoriesView = ({ filterStarred = false, focusId }: MemoriesViewProps) => {

  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const pageNavParent = useRef<HTMLElement | null>(null);

  //console.log("FocusId = ", focusId);
  // for now
  // const filterStarred = true;

  const apiRef = useTreeViewApiRef();

  const [treeData, setTreeData] = useState<MemoryTreeItem[]>([]);
  //const [treeData, setTreeData] = useState([]);

  const [selectedItem, setSelectedItem] = useState<MemoryItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null); // Track the expanded item
  const [newItemId, setNewItemId] = useState(null);

  const [showSnackBar, setShowSnackBar] = useState(false);

  const handleClick = (event: React.MouseEvent, item: MemoryItem) => {
    if (event.metaKey || event.ctrlKey) {
      console.log("ctrl key pressed");
      if (selectedItems.includes(item.id)) {
        setSelectedItems(selectedItems.filter((id) => id !== item.id));
      } else {
        setSelectedItems([...selectedItems, item.id]);
      }
    } else {
      setSelectedItems([item.id]);
      setSelectedItem(item);
    }



  };

  useEffect(() => {
    console.log("Selected items updated:", selectedItems);
  }, [selectedItems]);



  // Need to calculate the height of the header and the pagecontainer nav elelment as well as
  // any margin applied so that we can correctly calculate the box heights for scroll bars
  useLayoutEffect(() => {
    const headerEl = document.querySelector('header');
    const navEl = document.querySelector('nav.MuiBreadcrumbs-root');

    let navParentHeight = 0;
    let parentMarginTop = 0;

    if (navEl?.parentElement) {
      const container = navEl.parentElement as HTMLElement;

      // Get the parent of the container (i.e., grandparent of nav)
      const grandParent = container.parentElement as HTMLElement;
      if (grandParent) {
        const computedStyle = window.getComputedStyle(grandParent);
        const marginTopStr = computedStyle.marginTop;

        if (marginTopStr) {
          parentMarginTop = parseFloat(marginTopStr);
        }
      }

      navParentHeight = container.getBoundingClientRect().height;
      //  console.log('navParentHeight =', navParentHeight);
      //  console.log('parentMarginTop =', parentMarginTop);
    }

    if (headerEl) {
      const updateHeight = () => {
        const headerHeight = (headerEl as HTMLElement).getBoundingClientRect().height;
        const vh = window.innerHeight;
        setAvailableHeight(vh - headerHeight - navParentHeight - parentMarginTop);
      };

      updateHeight();
      window.addEventListener('resize', updateHeight);

      return () => {
        window.removeEventListener('resize', updateHeight);
      };
    }
  }, []);

  const getTreeData = async () => {
    //console.log("Fetching tree data...");
    const data = await fetchMemoryTree();
    //console.log("Tree data length = ", data.length)

    setTreeData(data);
    //console.log("data = ", data);
    //console.log("Tree data fetched");
  };

  useEffect(() => {
    // Fetch the tree data when the component is mounted
    getTreeData();
  }, []); // Empty dependency array ensures this runs only once


  useEffect(() => {
    if (focusId) {
      const ancestors = getAllAncestorIds(focusId, treeData);
      console.log("Ancestors:", ancestors);

      for (const ancestor of ancestors) {
        console.log("setItemExpansion: ", ancestor);
        if (apiRef.current) {
          apiRef.current.setItemExpansion({
            itemId: String(ancestor),
            shouldBeExpanded: true,
          });
        }
      }

      // Step 2: Scroll into view after a short delay to ensure it's rendered
      setTimeout(() => {
        const el = document.getElementById(`tree-item-${focusId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add('highlight');
          setTimeout(() => el.classList.remove('highlight'), 1500);

        } else {
          console.warn("Could not find element to scroll into view for ID:", expandedItemId);
        }
      }, 500); // Adjust delay if needed
      //const node = findNodeById(treeData, focusId);

      //console.log("findNodeById:", node);


    }
  }, [focusId, treeData]); // Add treeData here to ensure data is ready

  function getAllAncestorIds(searchId: string, tree: MemoryTreeItem[]) {
    const path: string[] = [];

    function findAndTrack(node: MemoryTreeItem, parentPath: string[] = []) {

      if (node.id == searchId) {
        path.push(...parentPath); // found it! collect the path
        return true;
      }

      if (node.children) {
        for (const child of node.children) {
          if (findAndTrack(child, [...parentPath, node.id])) {
            return true;
          }
        }
      }

      return false;
    }

    for (const rootNode of tree) {
      if (findAndTrack(rootNode)) {
        break;
      }
    }

    return path; // array of ancestor IDs from root to parent
  }

  const expandTest = () => {
    console.log("do it");
    if (apiRef.current) {
      apiRef.current.setItemExpansion({
        itemId: String("1"),
        shouldBeExpanded: true,
      });
    }
  }


  // UseEffect to call ExpandNewlyCreatedParent when data is ready and expandedItemId is set
  useEffect(() => {
    if (expandedItemId && treeData.length > 0) {
      ExpandNewlyCreatedParent(); // Call function to expand the parent after data is fetched
    }
  }, [expandedItemId, newItemId]); // Runs when either treeData or expandedItemId changes

  const handleDropUpdate = async (draggedItemId: string, newParentId: string) => {
    if (newParentId == "") {
      newParentId = "";
    }
    const allItems = Array.from(new Set([...selectedItems, draggedItemId]));
    console.log("allItems: ", allItems);
    await updateMemoryItemParent(allItems, newParentId);
    const data = await fetchMemoryTree();
    setTreeData(data);
  };

  const showMessage = (msg: string) => {
    setShowSnackBar(true);
  }

  const handleSave = async () => {
    if (!selectedItem) return;

    const { id, memory_key, name, memory_image, code_snippet, description } = selectedItem;
    await updateMemoryItem(id, memory_key, name, memory_image, code_snippet, description);
    showMessage("Save successful");
    getTreeData();
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    // Function to recursively delete items and their children
    const deleteItemAndChildren = async (itemId: string) => {
      const { data: children } = await supabase
        .from('memory_items')
        .select('id')
        .eq('parent_id', itemId);

      if (children) {
        for (const child of children) {
          await deleteItemAndChildren(child.id);
        }
      }

      // Then, delete the current item
      const { error } = await supabase
        .from('memory_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error("Error deleting item:", error);
      }
    };


    // Delete the selected item and all its children
    await deleteItemAndChildren(selectedItem.id);

    setSelectedItem(null);
    // Refresh the tree data after deletion
    getTreeData();
  };

  const handleCreateNewChild = async (parentId: string) => {
    try {

      const parentIdValue = parentId === "null" ? null : parentId;
      let highestMemoryKey = 0;
      console.log("handleCreateNewChild parentIdValue", parentIdValue)
      console.log("handleCreateNewChild parentId", parentId)

      if (!parentId) {
        console.log('create differnt query for this one')

        // If the parentId is null, we can't use  .eq('parent_id', parentId)

        // Step 1: Query for the rows where parent_id matches and order by memory_key descending
        const { data: highestMemoryKeyData, error: highestMemoryKeyError } = await supabase
          .from('memory_items')
          .select('memory_key')
          .is('parent_id', null)
          .order('memory_key', { ascending: false })  // Order by memory_key in descending order
          .limit(1);  // Limit to only the row with the highest memory_key

        highestMemoryKey = highestMemoryKeyData && highestMemoryKeyData.length > 0
          ? highestMemoryKeyData[0].memory_key + 1  // Set to 1 if no rows exist
          : 0;

        console.log("root?", highestMemoryKey, highestMemoryKeyData)
        if (highestMemoryKeyError) {
          throw new Error("Error fetching highest memory_key: " + highestMemoryKeyError.message);
        }

      } else {

        // Step 1: Query for the rows where parent_id matches and order by memory_key descending
        const { data: highestMemoryKeyData, error: highestMemoryKeyError } = await supabase
          .from('memory_items')
          .select('memory_key')
          .eq('parent_id', parentId)  // Filter by parent_id
          //  .filter('memory_key', 'is', null)  // This will filter out null values
          .order('memory_key', { ascending: false })  // Order by memory_key in descending order
          .limit(1);  // Limit to only the row with the highest memory_key

        highestMemoryKey = highestMemoryKeyData && highestMemoryKeyData.length > 0
          ? highestMemoryKeyData[0].memory_key + 1  // Set to 1 if no rows exist
          : 0;

        if (highestMemoryKeyData) {
          console.log('highestMemoryKeyData', highestMemoryKeyData[0])
        }

        if (highestMemoryKeyError) {
          throw new Error("Error fetching highest memory_key: " + highestMemoryKeyError.message);
        }

      }



      // Step 2: Determine the new memory_key value

      const newMemoryKey = highestMemoryKey++;
      // const newMemoryKey = highestMemoryKeyData && highestMemoryKeyData.length > 0
      //   ? highestMemoryKeyData[0].memory_key + 1  // Set to 1 if no rows exist
      //   : 1;

      // Step 3: Insert the new child item with the new memory_key
      const { error, data: newItem } = await supabase
        .from('memory_items')
        .insert([{
          name: 'New Child Item',
          memory_key: newMemoryKey,  // Use the new memory_key
          memory_image: '',
          parent_id: parentId,
        }])
        .select() // 👈 This tells Supabase to return the inserted row
        .single();

      console.log('newItem inserted = ', newItem);

      if (error) {
        console.error("Error creating new child item:", error);
      } else {
        setExpandedItemId(parentId);  // Set the expanded item to the newly created item's ID
        setNewItemId(newItem.id);
        const updatedData = await fetchMemoryTree();
        setTreeData(updatedData);  // Refresh tree data
      }
    } catch (err) {
      console.error("Error in handleCreateNewChild:", err);
    }
  };

  const mapTreeData = (data: MemoryTreeItem[], isRoot = true) => {

  
    const result = ((isRoot && filterStarred) ? data.filter((item) => item.starred !== false) : data) // Apply filter only at root level  
    .map((item) => (
        //<div>{item.id}</div>
        <DraggableTreeItem
          key={item.id}
          item={item}
          //itemId={item.id}
          onDropUpdate={handleDropUpdate}
          onSelectItem={handleClick}
          onCreateNewChild={handleCreateNewChild}
        >
          {item.children && item.children.length > 0 ? mapTreeData(item.children, false) : null}
        </DraggableTreeItem>
    ));
    return result;
  };



  // Function to expand the newly created parent item
  const ExpandNewlyCreatedParent = () => {
    console.log("ExpandNewlyCreatedParent");

    // Check if expandedItemId is set
    if (expandedItemId) {
      console.log("Expanding item with id ", expandedItemId);
      if (apiRef.current) {
        apiRef.current.setItemExpansion({
          itemId: String(expandedItemId),
          shouldBeExpanded: true,
        });
      }

      // Step 2: Scroll into view after a short delay to ensure it's rendered
      setTimeout(() => {
        const el = document.getElementById(`tree-item-${newItemId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add('highlight');
          setTimeout(() => el.classList.remove('highlight'), 1500);

        } else {
          console.warn("Could not find element to scroll into view for ID:", expandedItemId);
        }
      }, 200); // Adjust delay if needed

      //  apiRef.current.setItemExpansion(null, String(expandedItemId), true); // Expand the item
    }
  };

  return (
    <Box
      sx={{
        display: 'flex', // always flex
        flexDirection: { xs: 'column', lg: 'row' },
        gap: 2,
        p: 0,
        height: availableHeight ? `${availableHeight - 16}px` : 'auto',
        boxSizing: 'border-box',
      }}
    >
      <Box
        id="memoryTree"
        sx={{
          width: { xs: '100%', lg: '35%' },
          overflow: 'auto',
          height: { xs: '50%', lg: '100%' },
          borderRight: { lg: '1px solid #ccc' },
          pr: 2,
        }}
      >
        <DndProvider backend={HTML5Backend}>
          <SimpleTreeView
            multiSelect
            apiRef={apiRef}
            selectedItems={selectedItems.map(String)} // IDs must be strings
          >
            {mapTreeData(treeData)}
          </SimpleTreeView>
        </DndProvider>

      </Box>

      <Box
        id="memoryTreeItemData"
        sx={{
          width: { xs: '100%', lg: '65%' },
          overflow: 'auto',
          height: { xs: '50%', lg: '100%' },
          pl: 2,
        }}
      >
        {selectedItem ? (
          <>
            <ItemDetailsTab selectedItem={selectedItem} setSelectedItem={setSelectedItem} />

            {selectedItem.description && (
              <Box sx={{ flexShrink: 0, overflow: 'auto', maxHeight: '200px', marginBottom: '10px' }}>
                <Card>
                  <CardContent>
                    {selectedItem.description}
                  </CardContent>
                </Card>
              </Box>
            )}
            {selectedItem.code_snippet && (
              <Box sx={{ marginBottom: 2 }}>
                <CodeSnippet code={selectedItem.code_snippet} />
              </Box>
            )}

            {/* Sticky Footer INSIDE scrollable content */}
            <Box
              sx={{
                position: 'fixed',
                padding: 2,
                paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
                // borderTop: '1px solid #ccc',
                // backgroundColor: 'black',
                bottom: 0,
                zIndex: 1,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <ButtonGroup variant="contained" sx={{ width: '100%' }}>
                <Button onClick={handleSave} sx={{ width: '50%' }}>Save</Button>
                <Button color="error" onClick={handleDelete} sx={{ width: '50%' }}>
                  Delete
                </Button>
              </ButtonGroup>
            </Box>
          </>
        ) : (
          <Box sx={{ padding: 2 }}>Select an item to edit.</Box>
        )}


      </Box>
      <Snackbar
        open={showSnackBar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        autoHideDuration={2000}
        onClose={() => { setShowSnackBar(false) }}
      >
        <Alert
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          Save Successful
        </Alert>
      </Snackbar>
    </Box>
  )
};

export default MemoriesView;