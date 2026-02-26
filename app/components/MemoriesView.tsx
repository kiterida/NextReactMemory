// MemoriesView.tsx

'use client';
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toggleMemoryList, fetchRootItems, fetchChildren, fetchChildrenWithPath, fetchMemoryTree, updateMemoryItemParent, updateMemoryItem, updateStarred, insertMultipleItems } from './memoryData';
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
import Alert, { AlertColor } from '@mui/material/Alert';
import Snackbar, { SnackbarCloseReason } from '@mui/material/Snackbar';
//import { useSearchParams } from 'next/navigation';
import {
  Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions
} from '@mui/material';
import { Insert100Items } from '../function_lib/treeDataFunctions';

interface MemoriesViewProps {
  filterStarred?: boolean;
  focusId?: string | null; // or just `string` depending on your logic
  singleListView?: string | null;
}

type MemoryItem = {
  id: string;
  name?: string;
  description?: string;
  rich_text?: string;
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
  rich_text?: string;
  parent_id?: string | null;
  code_snippet?: string;
  memory_key?: string;
  memory_image?: string;
  starred?: boolean;
  has_children?: boolean;   
  child_count?: number;
  isLoadingChildren?: boolean;
  // ... add any other fields your items have (like `title`, `starred`, etc.)
  children?: MemoryTreeItem[];
}

function compareByMemoryKeyAsc(a: MemoryTreeItem, b: MemoryTreeItem): number {
  const aKey = Number(a.memory_key);
  const bKey = Number(b.memory_key);

  const aValue = Number.isFinite(aKey) ? aKey : Number.MAX_SAFE_INTEGER;
  const bValue = Number.isFinite(bKey) ? bKey : Number.MAX_SAFE_INTEGER;

  return aValue - bValue;
}

const MemoriesView = ({ filterStarred = false, focusId, singleListView }: MemoriesViewProps) => {


  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasFocusedRef = React.useRef<string | null>(null);
  const focusTargetRef = React.useRef<string | null>(null);
  const treeLoadVersionRef = React.useRef(0);

  // If we have a focusId passed in fro the url, we want to remove it after we have focused
  // the row.
  React.useEffect(() => {
    if (!focusId) return;

    // prevent re-running for the same id
    if (hasFocusedRef.current === focusId) return;
    hasFocusedRef.current = focusId;
    focusTargetRef.current = focusId;

    // 1) do your expand + focus logic here
    // expandAndFocus(focusId);
    getSearchItemWithParents(focusId);

    // 2) then remove "focus" from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete('focus');

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;

    router.replace(nextUrl, { scroll: false });
  }, [focusId, pathname, router, searchParams]);


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
  const [snackBarMsg, setSnackBarMsg] = useState("");
  const [snackBarMsgType, setSnackBarMsgType] = useState<AlertColor>("success");

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [contextMenuItemId, setContextMenuItemId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteChildCount, setDeleteChildCount] = useState(0);
  const [deleteTargetItem, setDeleteTargetItem] = useState<MemoryItem | null>(null);


  const [enableFocusItem, setEnableFocusItem] = useState(false);

  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);


  

  const handleClick = (event: React.MouseEvent, item: MemoryItem) => {
    if (event.metaKey || event.ctrlKey) {
      console.log("ctrl key pressed");
      if (selectedItems.includes(item.id)) {
        setSelectedItems(selectedItems.filter((id) => id !== item.id));
      } else {
        setSelectedItems([...selectedItems, item.id]);
      }
    } else {
      // If an item is expanded, it fires an onExpandedItemsChange={handleExpandedItemsChange}
      // So we only deal with gettting the data for the item clicked here, not the children.
      setSelectedItems([item.id]);
      setSelectedItem(item);
    }



  };

  const handleSetAsMemoryList = async (itemId : string, bSet : string) => {

     const newListId = await toggleMemoryList(itemId,bSet);  

     if(newListId != null)
      showMessage("Set to Memory List: memory_list_key: " + newListId);
    else
      showMessage("Unset as Memory List");

  }

  const cancelDeleteRevisionList = () => {
        console.log("User cancelled action");
        setConfirmDialogOpen(false); // just close
  };

  useEffect(() => {
    //console.log("Selected items updated:", selectedItems);
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

  const getSearchItemWithParents = async (targetFocusId?: string | null) => {
    const requestVersion = ++treeLoadVersionRef.current;

    if (!targetFocusId) {
      await getTreeData();
      return;
    }

    const [rootItems, pathItems] = await Promise.all([
      (fetchRootItems as (singleListViewId?: string | null) => Promise<MemoryTreeItem[]>)(
        singleListView ?? null
      ),
      fetchChildrenWithPath(targetFocusId),
    ]);

    const normalizeNode = (raw: any): MemoryTreeItem => ({
      ...raw,
      id: String(raw.id),
      parent_id: raw.parent_id === null || raw.parent_id === undefined ? null : String(raw.parent_id),
      children: Array.isArray(raw.children)
        ? raw.children.map((c: any) => ({
            ...c,
            id: String(c.id),
            parent_id: c.parent_id === null || c.parent_id === undefined ? null : String(c.parent_id),
          }))
        : raw.children,
    });

    const roots: MemoryTreeItem[] = Array.isArray(rootItems)
      ? rootItems.map((r: any) => normalizeNode(r))
      : [];
    const path: MemoryTreeItem[] = Array.isArray(pathItems)
      ? pathItems.map((p: any) => normalizeNode(p))
      : [];

    const targetId = String(targetFocusId);
    const includesTarget = path.some((p) => p.id === targetId);
    if (!includesTarget) {
      const { data: focusedItem, error: focusedItemError } = await supabase
        .from('memory_items')
        .select('id, name, description, rich_text, parent_id, code_snippet, memory_key, memory_image, starred')
        .eq('id', targetId)
        .single();

      if (!focusedItemError && focusedItem) {
        path.push(normalizeNode(focusedItem));
      }
    }

    if (path.length === 0) {
      console.log("path.length === 0,", roots);
      setTreeData(roots);
      return;
    }

    const nodeMap = new Map<string, MemoryTreeItem>();
    const mergedRoots: MemoryTreeItem[] = roots.map((r) => ({
      ...r,
      children: Array.isArray(r.children) ? [...r.children] : r.children,
    }));

    for (const root of mergedRoots) {
      nodeMap.set(root.id, root);
    }

    // Merge path data into existing node objects to preserve root references.
    for (const pathNode of path) {
      const existing = nodeMap.get(pathNode.id);
      if (existing) {
        existing.name = pathNode.name;
        existing.description = pathNode.description;
        existing.rich_text = pathNode.rich_text;
        existing.parent_id = pathNode.parent_id;
        existing.code_snippet = pathNode.code_snippet;
        existing.memory_key = pathNode.memory_key;
        existing.memory_image = pathNode.memory_image;
        existing.starred = pathNode.starred;
        existing.has_children = pathNode.has_children;
        existing.child_count = pathNode.child_count;
      } else {
        nodeMap.set(pathNode.id, { ...pathNode, children: [] });
      }
    }

    // Build direct focus path links.
    for (const pathNode of path) {
      const node = nodeMap.get(pathNode.id);
      if (!node) continue;

      if (node.children === undefined) {
        node.children = [];
      }

      const parentId = node.parent_id;
      if (!parentId) {
        if (!mergedRoots.some((r) => r.id === node.id)) {
          mergedRoots.push(node);
        }
        continue;
      }

      const parent = nodeMap.get(parentId);
      if (!parent) continue;

      const parentChildren = Array.isArray(parent.children) ? parent.children : [];
      if (!parentChildren.some((c) => c.id === node.id)) {
        parent.children = [...parentChildren, node].sort(compareByMemoryKeyAsc);
      } else {
        parent.children = parentChildren
          .map((c) => (c.id === node.id ? node : c))
          .sort(compareByMemoryKeyAsc);
      }
    }

    if (requestVersion !== treeLoadVersionRef.current) return;
    setTreeData(mergedRoots);
  }

  const getTreeData = async () => {
    const requestVersion = ++treeLoadVersionRef.current;

    //console.log("Fetching tree data...");
   // const data = await fetchMemoryTree();

    // Just load the parent lists first
    const data = await (fetchRootItems as (singleListViewId?: string | null) => Promise<MemoryTreeItem[]>)(
      singleListView ?? null
    );
    //console.log("Tree data length = ", data.length)

    if (requestVersion !== treeLoadVersionRef.current) return;
    setTreeData(data);
    console.log("data = ", data);
    //console.log("Tree data fetched");
  };

  useEffect(() => {
    // Initial non-focus load only. If focusId exists, the focus effect handles loading.
    if (focusId) return;
    getTreeData();
  }, [singleListView]);

  useEffect(() => {
    const handleMemoryListCreated = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      const createdId = customEvent.detail?.id;
      if (!createdId) return;

      focusTargetRef.current = String(createdId);
      getSearchItemWithParents(String(createdId));
    };

    window.addEventListener("memory-list-created", handleMemoryListCreated);
    return () => {
      window.removeEventListener("memory-list-created", handleMemoryListCreated);
    };
  }, []);

  // useEffect(() => {
  //   console.log("HERE WE GO")
  //   getSearchItemWithParents();
  //  // setEnableFocusItem(true);

  // },[focusId]);

  useEffect(() => {
    const effectiveFocusId = focusId ?? focusTargetRef.current;
    if (!effectiveFocusId) return;

    const targetNode = findNodeById(treeData, effectiveFocusId);
    if (!targetNode) return;

    // Keep UI selection in sync when we focus/scroll to a searched item.
    setSelectedItems([String(effectiveFocusId)]);
    setSelectedItem(targetNode as MemoryItem);

    const ancestors = getAllAncestorIds(effectiveFocusId, treeData).map(String);
    const missingAncestors = ancestors.filter((id) => !expandedItems.includes(id));

    // Expand path first.
    if (missingAncestors.length > 0) {
      setExpandedItems((prev) => Array.from(new Set([...prev, ...ancestors])));
      return;
    }

    // Then scroll/focus when DOM node exists.
    const domId = `tree-item-${effectiveFocusId}`;
    const tryFocus = () => {
      const el = document.getElementById(domId);
      if (!el) return false;

      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add('highlight');
      setTimeout(() => el.classList.remove('highlight'), 5000);
      focusTargetRef.current = null;
      return true;
    };

    if (tryFocus()) return;

    const raf = requestAnimationFrame(() => {
      tryFocus();
    });

    setTimeout(()=> { tryFocus()}, 1000);

    return () => cancelAnimationFrame(raf);
  }, [focusId, treeData, expandedItems]);

  

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
    if (expandedItemId && treeData.length > 0 && enableFocusItem) {
      ExpandNewlyCreatedParent(); // Call function to expand the parent after data is fetched
    }
  }, [expandedItemId, newItemId]); // Runs when either treeData or expandedItemId changes

  const handleDropUpdate = async (draggedItemId: string, newParentId: string | null) => {
    if (newParentId == "") {
      newParentId = "";
    }

    const allItems = Array.from(new Set([...selectedItems, draggedItemId]));
    console.log("allItems: ", allItems);
    await updateMemoryItemParent(allItems, newParentId);
    const data = await fetchMemoryTree();
    setTreeData(data);
  };

  const handlePromoteToParentList = async (itemId: string) => {
    await updateMemoryItemParent([itemId], null);
    await getTreeData();
    showMessage("Item promoted to parent list.", "success");
  };

  const handleSingleListView = (itemId: string) => {
    const clickedItem = findNodeById(treeData, String(itemId));
    if (!clickedItem || clickedItem.parent_id !== null) {
      showMessage("Single List View is only available for parent Memory Lists.", "warning");
      return;
    }

    router.push(`/singleListView?listId=${encodeURIComponent(String(itemId))}`);
  };

  /* Message Types:
  'error'
| 'info'
| 'success'
| 'warning'
*/
  const showMessage = (msg: string, type: AlertColor = "success") => {

    setSnackBarMsgType(type);
    setSnackBarMsg(msg);
    setShowSnackBar(true);
    
  }

  const handleSave = async () => {
    if (!selectedItem) return;

    const { id, memory_key, name, memory_image, code_snippet, description, rich_text } = selectedItem;
    const updatedItem = await updateMemoryItem(id, memory_key, name, memory_image, code_snippet, description, rich_text);
    if (!updatedItem) return;

    setSelectedItem((prev) => (prev && prev.id === id ? { ...prev, ...updatedItem } : prev));
    setTreeData((prev) =>
      updateNodeById(prev, id, (n) => ({
        ...n,
        ...updatedItem,
      }))
    );

    showMessage("Save successful");
  };

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

    const { error } = await supabase
      .from('memory_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error("Error deleting item:", error);
    }
  };

  const performDelete = async (item: MemoryItem) => {
    await deleteItemAndChildren(item.id);
    setSelectedItem(null);
    setSelectedItems((prev) => prev.filter((id) => id !== item.id));
    setTreeData((prev) => removeNodeById(prev, item.id));
  };

  const countDescendants = async (itemId: string): Promise<number> => {
    let total = 0;

    const walk = async (id: string) => {
      const { data: children, error } = await supabase
        .from('memory_items')
        .select('id')
        .eq('parent_id', id);

      if (error) {
        throw error;
      }

      const rows = children ?? [];
      total += rows.length;

      for (const child of rows) {
        await walk(child.id);
      }
    };

    await walk(itemId);
    return total;
  };

  const resolveDeleteTarget = async (targetId?: string | number): Promise<MemoryItem | null> => {
    if (targetId) {
      const normalizedTargetId = String(targetId);
      const fromTree = findNodeById(treeData, normalizedTargetId);
      if (fromTree) return fromTree as MemoryItem;

      const { data, error } = await supabase
        .from('memory_items')
        .select('id, name, description, rich_text, parent_id, code_snippet, memory_key, memory_image, starred')
        .eq('id', normalizedTargetId)
        .single();

      if (error) {
        console.error("Error finding delete target:", error);
        return null;
      }

      return data as MemoryItem;
    }

    return selectedItem;
  };

  const handleDelete = async (targetId?: string | number | React.MouseEvent) => {
    const resolvedTargetId =
      typeof targetId === 'string' || typeof targetId === 'number' ? targetId : undefined;
    const itemToDelete = await resolveDeleteTarget(resolvedTargetId);
    if (!itemToDelete) return;

    try {
      showMessage("Checking database for child items. Please wait.", "info")
      const descendants = await countDescendants(itemToDelete.id);

      if (descendants > 0) {
        setDeleteChildCount(descendants);
        setDeleteTargetItem(itemToDelete);
        setDeleteDialogOpen(true);
        return;
      }
      
      await performDelete(itemToDelete);
      showMessage("Row deleted.", "info")
    } catch (error) {
      console.error("Error preparing delete:", error);
    }
  };

  const handleCancelDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteTargetItem(null);
    setDeleteChildCount(0);
  };

  const handleConfirmDeleteDialog = async () => {
    if (!deleteTargetItem) return;

    const itemToDelete = deleteTargetItem;
    showMessage("Deleting rows. Please wait...", "warning")
    await performDelete(itemToDelete);
    showMessage("Rows deleted.", "info")
    setDeleteDialogOpen(false);
    setDeleteTargetItem(null);
    setDeleteChildCount(0);
  };

  // Open the confirm dialog box.
  const handleConfirmDialogBox = (itemId: string) => {
    setContextMenuItemId(itemId);
    setConfirmDialogOpen(true);
  }

  const handleReIndexMemoryKeysFromId = async (indexId: string) => {
    const startInput = window.prompt('Enter new starting memory_key value:', '0');
    if (startInput === null) {
      return;
    }

    const startKey = Number.parseInt(startInput, 10);
    if (!Number.isInteger(startKey)) {
      showMessage("Start value must be a valid integer.", "error");
      return;
    }

    try {
      const { data: anchorRow, error: anchorError } = await supabase
        .from('memory_items')
        .select('id, parent_id, memory_key')
        .eq('id', indexId)
        .single();

      if (anchorError || !anchorRow) {
        throw new Error(anchorError?.message ?? "Failed to load source item.");
      }

      const anchorMemoryKey = Number(anchorRow.memory_key);
      if (!Number.isFinite(anchorMemoryKey)) {
        throw new Error("Source item memory_key is not a valid number.");
      }

      let query = supabase
        .from('memory_items')
        .select('id, memory_key')
        .gte('memory_key', anchorMemoryKey)
        .order('memory_key', { ascending: true })
        .order('id', { ascending: true });

      if (anchorRow.parent_id === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', anchorRow.parent_id);
      }

      const { data: rowsToReindex, error: rowsError } = await query;
      if (rowsError) {
        throw new Error(rowsError.message);
      }

      const rows = rowsToReindex ?? [];
      if (rows.length === 0) {
        showMessage("No rows found to re-index from this item.", "info");
        return;
      }

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const nextKey = startKey + i;

        const { error: updateError } = await supabase
          .from('memory_items')
          .update({ memory_key: nextKey })
          .eq('id', row.id);

        if (updateError) {
          throw new Error(`Failed updating row ${row.id}: ${updateError.message}`);
        }
      }

      const parentIdForRefresh =
        anchorRow.parent_id === null ? null : String(anchorRow.parent_id);
      await refreshParentChildren(parentIdForRefresh);
      showMessage(`Re-indexed ${rows.length} row(s) starting at ${startKey}.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error re-indexing memory keys:", error);
      showMessage(`Failed to re-index memory keys: ${message}`, "error");
    }
  }

  const handleInsertMultiple = async () => {
    try{
     // const data = await insertMultipleItems(contextMenuItemId, 10);
     // showMessage("Succsefully inserted: " + data.length.toString() + " Rows", 'success');

      const data = await insertMultipleItems(contextMenuItemId, 10);

      showMessage(
        `Successfully inserted: ${data.length} Rows`,
        "success"
      );
    }
    catch (error: unknown) {
      let message = "Unknown error";

      if (error instanceof Error) {
        message = error.message;
      }

      showMessage(
        `Failed to insert items! ${message}`,
        "error"
      );
    }
    
    
    setConfirmDialogOpen(false);
    await refreshParentChildren(contextMenuItemId);
  };
  const handleCreateNewChild = async (parentId: string) => {
    try {

      const parentIdValue = parentId === "null" ? null : parentId;
      let highestMemoryKey = 0;
      //console.log("handleCreateNewChild parentIdValue", parentIdValue)
      //console.log("handleCreateNewChild parentId", parentId)

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

        //console.log("root?", highestMemoryKey, highestMemoryKeyData)
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
          //console.log('highestMemoryKeyData', highestMemoryKeyData[0])
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
          rich_text: '',
          parent_id: parentId,
        }])
        .select() // 👈 This tells Supabase to return the inserted row
        .single();

      //console.log('newItem inserted = ', newItem);

      if (error) {
        console.error("Error creating new child item:", error);
      } else {
        setExpandedItemId(parentId);  // Set the expanded item to the newly created item's ID
        setNewItemId(newItem.id);

        await refreshParentChildren(parentId);
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
          onConfirmDialogBox={handleConfirmDialogBox}
          onDeleteItem={handleDelete}
          onShowMessage={showMessage}
          onReIndexMemoryKeysFromId={handleReIndexMemoryKeysFromId}
          onPromoteToParentList={handlePromoteToParentList}
          onSingleListView={handleSingleListView}
          onSetAsMemoryList={handleSetAsMemoryList}
        >
          {item.children && item.children.length > 0 ? mapTreeData(item.children, false) : null}
        </DraggableTreeItem>
    ));
    return result;
  };



  // Function to expand the newly created parent item
  const ExpandNewlyCreatedParent = () => {
    //console.log("ExpandNewlyCreatedParent");

    const fakeEvent = {
      isPropagationStopped: () => false,
      stopPropagation: () => {},
    } as any;

    // Check if expandedItemId is set
    if (expandedItemId) {
      //console.log("Expanding item with id ", expandedItemId);
      if (apiRef.current) {
        apiRef.current.setItemExpansion({
          event: fakeEvent,
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

  function updateNodeById(
    nodes: MemoryTreeItem[],
    id: string,
    updater: (n: MemoryTreeItem) => MemoryTreeItem
  ): MemoryTreeItem[] {
    return nodes.map((n) => {
      if (n.id == id) return updater(n);
      if (!n.children) return n;
      return { ...n, children: updateNodeById(n.children, id, updater) };
    });
  }

  function findNodeById(nodes: MemoryTreeItem[], id: string): MemoryTreeItem | undefined {
    for (const node of nodes) {
      if (node.id == id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  function removeNodeById(nodes: MemoryTreeItem[], id: string): MemoryTreeItem[] {
    const result: MemoryTreeItem[] = [];

    for (const node of nodes) {
      if (node.id == id) continue;

      if (node.children) {
        const nextChildren = removeNodeById(node.children, id);
        const removedCount = node.children.length - nextChildren.length;

        result.push({
          ...node,
          children: nextChildren,
          child_count: typeof node.child_count === 'number'
            ? Math.max(0, node.child_count - removedCount)
            : node.child_count,
          has_children: nextChildren.length > 0,
        });
      } else {
        result.push(node);
      }
    }

    return result;
  }

  const refreshParentChildren = React.useCallback(async (parentId: string | null) => {
    if (!parentId) {
      const data = await (fetchRootItems as (singleListViewId?: string | null) => Promise<MemoryTreeItem[]>)(
        singleListView ?? null
      );
      setTreeData(data);
      return;
    }

    setTreeData((prev) =>
      updateNodeById(prev, parentId, (n) => ({ ...n, isLoadingChildren: true }))
    );

    try {
      const children = await fetchChildren(parentId);

      setTreeData((prev) =>
        updateNodeById(prev, parentId, (n) => ({
          ...n,
          isLoadingChildren: false,
          children: Array.isArray(children) ? children : [],
          child_count: Array.isArray(children) ? children.length : 0,
          has_children: Array.isArray(children) ? children.length > 0 : false,
        }))
      );
    } catch (error) {
      console.error("Failed to refresh children for parent:", parentId, error);
      setTreeData((prev) =>
        updateNodeById(prev, parentId, (n) => ({ ...n, isLoadingChildren: false }))
      );
    }
  }, [singleListView]);


    const ensureChildrenLoaded = React.useCallback(async (itemId: string) => {
      // find the node quickly if you have an id->node map, but recursion is fine to start
      const node = findNodeById(treeData, itemId);

      if (!node) {
        console.log("ensureChildrenLoaded: Didn't find Node");
        return;
      }

      // already loaded or currently loading
      if (node.children !== undefined || node.isLoadingChildren) {
        return;
      }

   
      // mark loading
      setTreeData((prev) =>
        updateNodeById(prev, itemId, (n) => ({ ...n, isLoadingChildren: true }))
      );

      try {
        const children = await fetchChildren(itemId);

        setTreeData((prev) =>
          updateNodeById(prev, itemId, (n) => ({
            ...n,
            isLoadingChildren: false,
            children: Array.isArray(children) ? children : [],
          }))
        );
      } catch (error) {
        console.error("Failed to load children for item:", itemId, error);
        setTreeData((prev) =>
          updateNodeById(prev, itemId, (n) => ({
            ...n,
            isLoadingChildren: false,
            children: [],
          }))
        );
      }
  }, [treeData]);

  const handleExpandedItemsChange = React.useCallback(
    async (_event: unknown, nextExpanded: string[]) => {
      // figure out which item(s) were newly expanded
       //console.log("handleExpandedItemsChange");
    
      const newlyExpanded = nextExpanded.filter((id) => !expandedItems.includes(id));

      setExpandedItems(nextExpanded);

      //console.log("Newley expanded: ", newlyExpanded);

      // load children for any newly expanded item
      for (const id of newlyExpanded) {
        await ensureChildrenLoaded(id);
      }
    },
    [expandedItems, ensureChildrenLoaded]
  );

  useEffect(() => {
    const effectiveFocusId = focusId ?? focusTargetRef.current;
    if (!effectiveFocusId) return;
    if (expandedItems.length === 0) return;

    let cancelled = false;

    const loadExpandedForFocus = async () => {
      for (const id of expandedItems) {
        if (cancelled) return;
        await ensureChildrenLoaded(id);
      }
    };

    loadExpandedForFocus();

    return () => {
      cancelled = true;
    };
  }, [focusId, expandedItems, ensureChildrenLoaded]);

  return (
    <>
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
            expandedItems={expandedItems}
            onExpandedItemsChange={handleExpandedItemsChange}
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
              <Box sx={{ flexShrink: 0, overflow: 'auto', maxHeight: '400px', marginBottom: '10px' }}>
                <Card>
                  <CardContent
                    sx={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
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
                <Button color="error" onClick={() => handleDelete()} sx={{ width: '50%' }}>
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
          severity={snackBarMsgType}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackBarMsg}
        </Alert>
      </Snackbar>
    </Box>

     <Dialog
        open={confirmDialogOpen}
        onClose={cancelDeleteRevisionList}
    >
        <DialogTitle>{"Are you sure you want to insert 10 Items?"}</DialogTitle>
        <DialogContent>
            <DialogContentText>
                10 new sub items will be added to this item. The memory_key will start from the hightest value in the database and be incremented.
            </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={cancelDeleteRevisionList} color="error">
                Cancel
            </Button>
            <Button onClick={() => handleInsertMultiple()} color="primary" autoFocus>
                Insert
            </Button>
        </DialogActions>
    </Dialog>

    <Dialog
      open={deleteDialogOpen}
      onClose={handleCancelDeleteDialog}
    >
      <DialogTitle>{"Delete Item and Children?"}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This will delete the selected item and {deleteChildCount} child item{deleteChildCount === 1 ? '' : 's'}. This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelDeleteDialog} color="primary">
          Cancel
        </Button>
        <Button onClick={handleConfirmDeleteDialog} color="error" autoFocus>
          Delete All
        </Button>
      </DialogActions>
    </Dialog>
    </>
  )
};

export default MemoriesView;
