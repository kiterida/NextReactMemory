// MemoriesView.tsx

'use client';
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toggleMemoryList, fetchRootItems, fetchChildren, fetchChildrenWithPath, updateMemoryItemParent, updateStarred, insertMultipleItems, compareMemoryTreeItems, sortMemoryTreeNodes } from './memoryData';
import LinkExistingMemoryItemDialog from './LinkExistingMemoryItemDialog';
import { countDirectDescendants, createMemoryNodeWithSharedOrdering, deleteDirectMemoryItemTree, deleteMemoryItemLink, getNextMemoryKeyForParent, saveMemoryAppearance } from './memoryLinkData';
import { supabase } from './supabaseClient';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useTreeViewApiRef } from '@mui/x-tree-view/hooks';
import { DndProvider, useDrop, useDragLayer } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DraggableTreeItem from './DraggableTreeItem';
import { Backdrop, Box, Card, CardContent, CircularProgress, Typography } from '@mui/material';
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
  source_item_id?: string;
  source_parent_id?: string | null;
  link_id?: string | null;
  is_linked?: boolean;
  tree_parent_id?: string | null;
  name?: string;
  description?: string;
  rich_text?: string;
  parent_id?: string | null;
  list_id?: string | null;
  item_type?: string | null;
  is_testable?: boolean;
  code_snippet?: string;
  memory_key?: string | number | null;
  row_order?: string | number | null;
  memory_image?: string;
  header_image?: string;
  starred?: boolean;
  memory_list_key?: string | number | null;
};

type RichTextDraftGetter = () => {
  itemIdentity: string;
  richText: string;
};

export interface MemoryTreeItem {
  id: string;
  source_item_id?: string;
  source_parent_id?: string | null;
  link_id?: string | null;
  is_linked?: boolean;
  tree_parent_id?: string | null;
  name?: string;
  description?: string;
  rich_text?: string;
  parent_id?: string | null;
  list_id?: string | null;
  item_type?: string | null;
  is_testable?: boolean;
  code_snippet?: string;
  memory_key?: string | number | null;
  row_order?: string | number | null;
  memory_image?: string;
  header_image?: string;
  starred?: boolean;
  memory_list_key?: string | number | null;
  has_children?: boolean;   
  child_count?: number;
  isLoadingChildren?: boolean;
  // ... add any other fields your items have (like `title`, `starred`, etc.)
  children?: MemoryTreeItem[];
}

const TREE_ITEM_DND_TYPE = 'TREE_ITEM';

const getTreeNodeId = (raw: any) => {
  if (raw?.is_linked && raw?.link_id !== null && raw?.link_id !== undefined) {
    return `link-${raw.link_id}`;
  }

  return String(raw?.id);
};

const normalizeTreeNode = (raw: any): MemoryTreeItem => {
  const sourceItemId = String(raw?.source_item_id ?? raw?.id);
  const isLinked = Boolean(raw?.is_linked);

  return {
    ...raw,
    id: getTreeNodeId(raw),
    source_item_id: sourceItemId,
    source_parent_id:
      raw?.parent_id === null || raw?.parent_id === undefined ? null : String(raw.parent_id),
    link_id: raw?.link_id === null || raw?.link_id === undefined ? null : String(raw.link_id),
    is_linked: isLinked,
    parent_id:
      raw?.parent_id === null || raw?.parent_id === undefined ? null : String(raw.parent_id),
    tree_parent_id:
      raw?.parent_id === null || raw?.parent_id === undefined ? null : String(raw.parent_id),
    has_children: isLinked ? false : Boolean(raw?.has_children),
    child_count: isLinked ? 0 : Number(raw?.child_count ?? 0),
    children: Array.isArray(raw?.children) ? raw.children.map((child: any) => normalizeTreeNode(child)) : raw?.children,
  };
};
const RootDropZone = ({
  onDropToRoot,
}: {
  onDropToRoot: (draggedItemId: string) => void;
}) => {
  const isDraggingTreeItem = useDragLayer((monitor) => {
    if (!monitor.isDragging()) {
      return false;
    }

    const itemType = monitor.getItemType();
    return itemType === TREE_ITEM_DND_TYPE || itemType === 'TREE_ITEM';
  });

  const [{ isOver }, dropRef] = useDrop(
    () => ({
      accept: TREE_ITEM_DND_TYPE,
      drop: (draggedItem: { id: string }, monitor) => {
        if (monitor.didDrop()) return;
        onDropToRoot(String(draggedItem.id));
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
      }),
    }),
    [onDropToRoot]
  );

  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        dropRef(node);
      }}
      sx={(theme) => ({
        position: 'fixed',
        top: 96,
        left: 24,
        zIndex: 1600,
        px: 2,
        py: 1.25,
        border: '1px dashed',
        borderColor: isOver ? theme.palette.primary.main : theme.palette.divider,
        borderRadius: 1.5,
        backgroundColor: isOver
          ? theme.palette.background.paper
          : theme.palette.mode === 'dark'
            ? 'rgba(18, 18, 18, 0.96)'
            : 'rgba(255, 255, 255, 0.92)',
        boxShadow: isDraggingTreeItem ? theme.shadows[4] : 'none',
        color: isOver
          ? theme.palette.text.primary
          : theme.palette.mode === 'dark'
            ? theme.palette.grey[100]
            : theme.palette.text.secondary,
        fontSize: '0.875rem',
        opacity: isDraggingTreeItem ? 1 : 0,
        transform: isDraggingTreeItem ? 'translateY(0)' : 'translateY(-8px)',
        pointerEvents: isDraggingTreeItem ? 'auto' : 'none',
        transition: 'opacity 120ms ease, transform 120ms ease, border-color 120ms ease, background-color 120ms ease',
      })}
    >
      Drop here to move item to top level
    </Box>
  );
};

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
  const [deleteProgressOpen, setDeleteProgressOpen] = useState(false);
  const [deleteProgressMessage, setDeleteProgressMessage] = useState('');

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [contextMenuItemId, setContextMenuItemId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteChildCount, setDeleteChildCount] = useState(0);
  const [deleteTargetItem, setDeleteTargetItem] = useState<MemoryItem | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTargetItem, setLinkTargetItem] = useState<MemoryItem | null>(null);
  const [defaultLinkMemoryKey, setDefaultLinkMemoryKey] = useState<number | null>(null);


  const [enableFocusItem, setEnableFocusItem] = useState(false);

  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const richTextDraftGetterRef = useRef<RichTextDraftGetter | null>(null);


  

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

  const handleSetAsMemoryList = async (itemId : string, bSet : boolean) => {
     const clickedItem = findNodeById(treeData, String(itemId));
     const sourceItemId = clickedItem?.source_item_id ?? itemId;

     const newListId = await toggleMemoryList(sourceItemId,bSet);  

     if(newListId != null)
      showMessage("Set as Memory List root. memory_list_key: " + newListId);
     else
      showMessage("Unset as Memory List");

     await getSearchItemWithParents(sourceItemId);

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
      (fetchRootItems as (singleListViewId?: string | null, filterStarred?: boolean) => Promise<MemoryTreeItem[]>)(
        singleListView ?? null,
        filterStarred
      ),
      fetchChildrenWithPath(targetFocusId),
    ]);

    const roots: MemoryTreeItem[] = Array.isArray(rootItems)
      ? rootItems.map((r: any) => normalizeTreeNode(r))
      : [];
    const path: MemoryTreeItem[] = Array.isArray(pathItems)
      ? pathItems.map((p: any) => normalizeTreeNode(p))
      : [];

    const targetId = String(targetFocusId);
    const includesTarget = path.some((p) => p.id === targetId);
    if (!includesTarget) {
      const { data: focusedItem, error: focusedItemError } = await supabase
        .from('memory_items')
        .select('id, name, description, rich_text, parent_id, list_id, item_type, is_testable, code_snippet, memory_key, row_order, memory_image, header_image, starred, memory_list_key')
        .eq('id', targetId)
        .single();

      if (!focusedItemError && focusedItem) {
        path.push(normalizeTreeNode(focusedItem));
      }
    }

    if (path.length === 0) {
      console.log("path.length === 0,", roots);
      setTreeData(sortMemoryTreeNodes(dedupeTreeNodes(roots)));
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
        existing.row_order = pathNode.row_order;
        existing.memory_image = pathNode.memory_image;
        existing.header_image = pathNode.header_image;
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
        parent.children = [...parentChildren, node].sort(compareMemoryTreeItems);
      } else {
        parent.children = parentChildren
          .map((c) => (c.id === node.id ? node : c))
          .sort(compareMemoryTreeItems);
      }
    }

    if (requestVersion !== treeLoadVersionRef.current) return;
    setTreeData(sortMemoryTreeNodes(dedupeTreeNodes(mergedRoots)));
  }

  const getTreeData = async () => {
    const requestVersion = ++treeLoadVersionRef.current;

    //console.log("Fetching tree data...");
   // const data = await fetchMemoryTree();

    // Just load the parent lists first
    const data = await (fetchRootItems as (singleListViewId?: string | null, filterStarred?: boolean) => Promise<MemoryTreeItem[]>)(
      singleListView ?? null,
      filterStarred
    );
    const normalizedData = (data ?? []).map((item: any) => normalizeTreeNode(item));
    //console.log("Tree data length = ", data.length)

    if (requestVersion !== treeLoadVersionRef.current) return;
    setTreeData(sortMemoryTreeNodes(dedupeTreeNodes(normalizedData)));
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

  useEffect(() => {
    const handleMemoryItemTypeUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      const updatedId = customEvent.detail?.id;
      if (!updatedId) return;

      focusTargetRef.current = String(updatedId);
      getSearchItemWithParents(String(updatedId));
    };

    window.addEventListener("memory-item-type-updated", handleMemoryItemTypeUpdated);
    return () => {
      window.removeEventListener("memory-item-type-updated", handleMemoryItemTypeUpdated);
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

  function getTopLevelListIdForItem(itemId: string, tree: MemoryTreeItem[]): string | null {
    const node = findNodeById(tree, itemId);
    if (!node) {
      return null;
    }

    const ancestors = getAllAncestorIds(itemId, tree);
    const topLevelId = ancestors.length === 0 ? String(node.id) : String(ancestors[0]);
    const topLevelNode = findNodeById(tree, topLevelId);
    return topLevelNode ? String(topLevelNode.source_item_id ?? topLevelNode.id) : null;
  }

  useEffect(() => {
    const listOptions = treeData
      .map((item) => ({
        id: String(item.id),
        name: item.name ?? `List ${item.id}`,
      }));

    const selectedListId = selectedItem
      ? getTopLevelListIdForItem(String(selectedItem.id), treeData)
      : null;

    window.dispatchEvent(
      new CustomEvent('memory-search-context', {
        detail: {
          selectedListId,
          lists: listOptions,
        },
      })
    );
  }, [selectedItem, treeData]);

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
    const normalizedParentId = newParentId ? String(newParentId) : null;
    const allItems = Array.from(new Set([...selectedItems, draggedItemId])).map(String);

    const treeMoveIds = getTopLevelMoveIds(allItems, treeData);

    if (treeMoveIds.length === 0) {
      return;
    }

    if (normalizedParentId && treeMoveIds.includes(normalizedParentId)) {
      return;
    }

    const targetNode = normalizedParentId ? findNodeById(treeData, normalizedParentId) : undefined;
    if (
      targetNode &&
      treeMoveIds.some((id) => {
        const draggedNode = findNodeById(treeData, id);
        return draggedNode ? nodeContainsId(draggedNode, String(targetNode.id)) : false;
      })
    ) {
      showMessage("You can't drop an item into its own child branch.", "warning");
      return;
    }

    const currentParentIds = new Set(
      treeMoveIds
        .map((id) => findNodeById(treeData, id)?.parent_id ?? null)
        .map((id) => (id ? String(id) : null))
    );

    if (currentParentIds.size === 1 && currentParentIds.has(normalizedParentId)) {
      return;
    }

    await updateMemoryItemParent(treeMoveIds, normalizedParentId);

    setTreeData((prev) =>
      sortMemoryTreeNodes(
        dedupeTreeNodes(moveNodesInTree(prev, treeMoveIds, normalizedParentId))
      )
    );

    setSelectedItem((prev) =>
      prev && treeMoveIds.includes(String(prev.id))
        ? { ...prev, parent_id: normalizedParentId }
        : prev
    );
  };

  const handlePromoteToParentList = async (itemId: string) => {
    const clickedItem = findNodeById(treeData, String(itemId));
    if (clickedItem?.is_linked) {
      showMessage("Linked rows cannot be promoted because they only point to the source item.", "warning");
      return;
    }

    await updateMemoryItemParent([clickedItem?.source_item_id ?? itemId], null);
    await getTreeData();
    showMessage("Item promoted to parent list.", "success");
  };

  const handleSingleListView = (itemId: string) => {
    const clickedItem = findNodeById(treeData, String(itemId));
    // if (!clickedItem || clickedItem.parent_id !== null) {
    //   showMessage("Single List View is only available for parent Memory Lists.", "warning");
    //   return;
    // }
    router.push(`/singleListView?listId=${encodeURIComponent(String(clickedItem?.source_item_id ?? itemId))}`);
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
    
  };

  const showDeleteProgress = (message: string) => {
    setDeleteProgressMessage(message);
    setDeleteProgressOpen(true);
  };

  const hideDeleteProgress = () => {
    setDeleteProgressOpen(false);
    setDeleteProgressMessage('');
  };

  const handleSave = async () => {
    if (!selectedItem) return;

    try {
      const selectedItemIdentity = String(selectedItem.source_item_id ?? selectedItem.id);
      const currentRichTextDraft = richTextDraftGetterRef.current?.();
      const itemToSave =
        currentRichTextDraft && currentRichTextDraft.itemIdentity === selectedItemIdentity
          ? { ...selectedItem, rich_text: currentRichTextDraft.richText }
          : selectedItem;

      const saveResult = await saveMemoryAppearance(itemToSave);
      const sourceId = String(itemToSave.source_item_id ?? itemToSave.id);

      const updateSourceAcrossTree = (nodes: MemoryTreeItem[]): MemoryTreeItem[] =>
        nodes.map((node) => ({
          ...node,
          ...(String(node.source_item_id ?? node.id) === sourceId
            ? {
                ...saveResult.sourceItem,
                memory_key: node.is_linked ? node.memory_key : saveResult.sourceItem.memory_key,
                row_order: node.is_linked ? node.row_order : saveResult.sourceItem.row_order,
              }
            : {}),
          id: node.id,
          source_item_id: node.source_item_id,
          source_parent_id: node.source_parent_id,
          link_id: node.link_id,
          is_linked: node.is_linked,
          tree_parent_id: node.tree_parent_id,
          parent_id: node.parent_id,
          children: Array.isArray(node.children) ? updateSourceAcrossTree(node.children) : node.children,
        }));

      setSelectedItem((prev) =>
        prev && prev.id === itemToSave.id
          ? {
              ...prev,
              ...saveResult.sourceItem,
              id: prev.id,
              source_item_id: prev.source_item_id,
              source_parent_id: prev.source_parent_id,
              link_id: prev.link_id,
              is_linked: prev.is_linked,
              tree_parent_id: prev.tree_parent_id,
              parent_id: prev.parent_id,
              memory_key: saveResult.displayMemoryKey,
              row_order: saveResult.displayRowOrder,
            }
          : prev
      );

      setTreeData((prev) =>
        sortMemoryTreeNodes(
          updateNodeById(updateSourceAcrossTree(prev), itemToSave.id, (node) => ({
            ...node,
            memory_key: saveResult.displayMemoryKey,
            row_order: saveResult.displayRowOrder,
          }))
        )
      );

      showMessage(itemToSave.is_linked ? "Linked item saved and source content updated." : "Save successful");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error saving item:", error);
      showMessage(`Failed to save item: ${message}`, "error");
    }
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
    const treeNodeId = String(item.id);
    const sourceItemId = String(item.source_item_id ?? item.id);

    if (item.is_linked && item.link_id) {
      await deleteMemoryItemLink(item.link_id);
      setSelectedItem((prev) => (prev?.id === treeNodeId ? null : prev));
      setSelectedItems((prev) => prev.filter((id) => id !== treeNodeId));
      setTreeData((prev) => sortMemoryTreeNodes(removeNodeById(prev, treeNodeId)));
      return;
    }

    await deleteDirectMemoryItemTree(sourceItemId);
    setSelectedItem((prev) => {
      if (!prev) return prev;
      return String(prev.source_item_id ?? prev.id) === sourceItemId ? null : prev;
    });
    setSelectedItems((prev) =>
      prev.filter((id) => String(findNodeById(treeData, id)?.source_item_id ?? id) !== sourceItemId)
    );
    setTreeData((prev) =>
      sortMemoryTreeNodes(
        removeNodeById(prev, treeNodeId)
      )
    );
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
        .select('id, name, description, rich_text, parent_id, list_id, item_type, is_testable, code_snippet, memory_key, row_order, memory_image, header_image, starred, memory_list_key')
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
      if (itemToDelete.is_linked) {
        showDeleteProgress('Removing link. Please wait...');
        await performDelete(itemToDelete);
        showMessage('Link removed.', 'info');
        return;
      }

      showDeleteProgress('Checking database for child items. Please wait...');
      const descendants = await countDirectDescendants(itemToDelete.source_item_id ?? itemToDelete.id);

      if (descendants > 0) {
        setDeleteChildCount(descendants);
        setDeleteTargetItem(itemToDelete);
        setDeleteDialogOpen(true);
        return;
      }

      showDeleteProgress('Deleting item. Please wait...');
      await performDelete(itemToDelete);
      showMessage('Row deleted.', 'info');
    } catch (error) {
      console.error('Error preparing delete:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showMessage(`Failed to delete item: ${message}`, 'error');
    } finally {
      hideDeleteProgress();
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

    try {
      setDeleteDialogOpen(false);
      showDeleteProgress('Deleting rows. Please wait...');
      await performDelete(itemToDelete);
      showMessage('Rows deleted.', 'info');
      setDeleteTargetItem(null);
      setDeleteChildCount(0);
    } catch (error) {
      console.error('Error deleting rows:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showMessage(`Failed to delete rows: ${message}`, 'error');
    } finally {
      hideDeleteProgress();
    }
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

  const handleOpenLinkDialog = async (targetId: string) => {
    const targetItem = findNodeById(treeData, String(targetId));
    if (!targetItem) {
      showMessage("Could not resolve the destination item.", "error");
      return;
    }

    if (targetItem.is_linked) {
      showMessage("Linking into a linked appearance is not supported in this incremental version.", "warning");
      return;
    }

    try {
      const nextMemoryKey = await getNextMemoryKeyForParent(targetItem.source_item_id ?? targetItem.id);
      setDefaultLinkMemoryKey(nextMemoryKey);
    } catch (error) {
      console.error("Error fetching next memory key for link:", error);
      setDefaultLinkMemoryKey(null);
    }

    setLinkTargetItem(targetItem as MemoryItem);
    setLinkDialogOpen(true);
  };

  const handleCloseLinkDialog = () => {
    setLinkDialogOpen(false);
    setLinkTargetItem(null);
    setDefaultLinkMemoryKey(null);
  };

  const handleLinkCreated = async () => {
    if (!linkTargetItem) {
      return;
    }

    await refreshParentChildren(linkTargetItem.id);
    showMessage("Linked item added to this list.", "success");
  };

  const handleCreateNewChild = async (parentId: string) => {
    try {
      const newItem = await createMemoryNodeWithSharedOrdering({
        parentId: (parentId || null) as any,
        name: 'New Child Item',
      } as any);

      setExpandedItemId(parentId);
      setNewItemId(newItem.id);
      await refreshParentChildren(parentId);
      return;

      /*
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
      const { error, data: legacyNewItem } = await supabase
        .from('memory_items')
        .insert([{
          name: 'New Child Item',
          memory_key: newMemoryKey,  // Use the new memory_key
          row_order: newMemoryKey,
          memory_image: '',
          header_image: '',
          rich_text: '',
          parent_id: parentId,
        }])
        .select() // Returns the inserted row
        .single();

      //console.log('newItem inserted = ', newItem);

      if (error) {
        console.error("Error creating new child item:", error);
      } else {
        setExpandedItemId(parentId);  // Set the expanded item to the newly created item's ID
        setNewItemId(legacyNewItem.id);

        await refreshParentChildren(parentId);
      }
      */
    } catch (err) {
      console.error("Error in handleCreateNewChild:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      showMessage(`Failed to create child item: ${message}`, "error");
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
          onLinkExistingItemHere={handleOpenLinkDialog}
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

  function nodeContainsId(node: MemoryTreeItem, targetId: string): boolean {
    if (String(node.id) === String(targetId)) return true;
    if (!Array.isArray(node.children)) return false;
    return node.children.some((child) => nodeContainsId(child, targetId));
  }

  function cloneNodeWithParent(node: MemoryTreeItem, parentId: string | null): MemoryTreeItem {
    return {
      ...node,
      parent_id: parentId,
      tree_parent_id: parentId,
      children: Array.isArray(node.children)
        ? node.children.map((child) => cloneNodeWithParent(child, String(node.id)))
        : node.children,
    };
  }

  function getTopLevelMoveIds(ids: string[], nodes: MemoryTreeItem[]): string[] {
    const requestedIds = new Set(ids.map(String));

    return ids
      .map(String)
      .filter((id) => {
      const node = findNodeById(nodes, id);
      if (!node || node.is_linked) return false;

        let currentParentId = node.parent_id ? String(node.parent_id) : null;
        while (currentParentId) {
          if (requestedIds.has(currentParentId)) {
            return false;
          }
          const parentNode = findNodeById(nodes, currentParentId);
          currentParentId = parentNode?.parent_id ? String(parentNode.parent_id) : null;
        }

        return true;
      });
  }

  function insertNodesAtParent(
    nodes: MemoryTreeItem[],
    parentId: string | null,
    newNodes: MemoryTreeItem[]
  ): MemoryTreeItem[] {
    if (parentId === null) {
      return [...nodes, ...newNodes];
    }

    return nodes.map((node) => {
      if (String(node.id) === String(parentId)) {
        const nextChildren = Array.isArray(node.children)
          ? [...node.children, ...newNodes]
          : node.children;

        return {
          ...node,
          children: nextChildren,
          child_count: typeof node.child_count === 'number'
            ? node.child_count + newNodes.length
            : Array.isArray(nextChildren)
              ? nextChildren.length
              : newNodes.length,
          has_children: true,
        };
      }

      if (!node.children) {
        return node;
      }

      return {
        ...node,
        children: insertNodesAtParent(node.children, parentId, newNodes),
      };
    });
  }

  function moveNodesInTree(
    nodes: MemoryTreeItem[],
    moveIds: string[],
    newParentId: string | null
  ): MemoryTreeItem[] {
    const movingNodes = moveIds
      .map((id) => findNodeById(nodes, id))
      .filter((node): node is MemoryTreeItem => Boolean(node))
      .map((node) => cloneNodeWithParent(node, newParentId));

    const prunedTree = moveIds.reduce(
      (currentNodes, id) => removeNodeById(currentNodes, id),
      nodes
    );

    if (newParentId !== null && !findNodeById(prunedTree, newParentId)) {
      return nodes;
    }

    return insertNodesAtParent(prunedTree, newParentId, movingNodes);
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

  function dedupeTreeNodes(nodes: MemoryTreeItem[], seen = new Set<string>()): MemoryTreeItem[] {
    const result: MemoryTreeItem[] = [];

    for (const node of nodes) {
      const nodeId = String(node.id);
      if (seen.has(nodeId)) {
        continue;
      }

      seen.add(nodeId);
      result.push({
        ...node,
        children: Array.isArray(node.children) ? dedupeTreeNodes(node.children, seen) : node.children,
      });
    }

    return result;
  }

  const refreshParentChildren = React.useCallback(async (parentId: string | null) => {
    if (!parentId) {
      const data = await (fetchRootItems as (singleListViewId?: string | null, filterStarred?: boolean) => Promise<MemoryTreeItem[]>)(
        singleListView ?? null,
        filterStarred
      );
      setTreeData(sortMemoryTreeNodes((data ?? []).map((item: any) => normalizeTreeNode(item))));
      return;
    }

    setTreeData((prev) =>
      updateNodeById(prev, parentId, (n) => ({ ...n, isLoadingChildren: true }))
    );

    try {
      const children = await fetchChildren(parentId);
      const normalizedChildren = Array.isArray(children)
        ? children.map((child: any) => normalizeTreeNode(child))
        : [];

      setTreeData((prev) =>
        sortMemoryTreeNodes(
          dedupeTreeNodes(
            updateNodeById(prev, parentId, (n) => ({
              ...n,
              isLoadingChildren: false,
              children: normalizedChildren,
              child_count: normalizedChildren.length,
              has_children: normalizedChildren.length > 0,
            }))
          )
        )
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
        const normalizedChildren = Array.isArray(children)
          ? children.map((child: any) => normalizeTreeNode(child))
          : [];

        setTreeData((prev) =>
          sortMemoryTreeNodes(
            dedupeTreeNodes(
              updateNodeById(prev, itemId, (n) => ({
                ...n,
                isLoadingChildren: false,
                children: normalizedChildren,
              }))
            )
          )
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
          <RootDropZone onDropToRoot={(draggedItemId) => handleDropUpdate(draggedItemId, null)} />
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
            <ItemDetailsTab
              selectedItem={selectedItem}
              setSelectedItem={setSelectedItem}
              onShowMessage={showMessage}
              onRegisterRichTextDraftGetter={(getter: RichTextDraftGetter | null) => {
                richTextDraftGetterRef.current = getter;
              }}
            />

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
                  {selectedItem?.is_linked ? 'Remove Link' : 'Delete'}
                  </Button>
                </ButtonGroup>
              </Box>
          </>
        ) : (
          <Box sx={{ padding: 2 }}>Select an item to edit.</Box>
        )}


      </Box>
      <Backdrop
        open={deleteProgressOpen}
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1, flexDirection: 'column', gap: 2 }}
      >
        <CircularProgress color="inherit" />
        <Typography variant="body1">{deleteProgressMessage || 'Working...'}</Typography>
      </Backdrop>
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

    <LinkExistingMemoryItemDialog
      open={linkDialogOpen}
      destinationItem={linkTargetItem}
      defaultMemoryKey={defaultLinkMemoryKey}
      onClose={handleCloseLinkDialog}
      onLinked={handleLinkCreated}
    />
    </>
  )
};

export default MemoriesView;



