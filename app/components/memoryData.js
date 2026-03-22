// src/memoryData.js
import { supabase } from './supabaseClient';

export const searchMemoryItems = async (searchString) => {
  const { data, error } = await supabase
    .from('memory_items')
    .select('*')
    .or(
      `name.ilike.%${searchString}%,description.ilike.%${searchString}%,rich_text.ilike.%${searchString}%,code_snippet.ilike.%${searchString}%`
    );

  if (error) {
    console.error("Error fetching memory items:", error);
    return [];
  }

  return data;
};

const ADVANCED_SEARCH_COLUMNS = ['memory_key', 'name', 'memory_image', 'header_image', 'description', 'rich_text'];
export const MEMORY_ITEM_TYPES = {
  GROUP: 'group',
  LIST: 'list',
  FOLDER: 'folder',
  SPLITTER_FOLDER: 'splitter_folder',
  ITEM: 'item',
};

const DEFAULT_MEMORY_ITEM_SELECT = `
  id,
  parent_id,
  list_id,
  item_type,
  is_testable,
  memory_key,
  row_order,
  name,
  memory_image,
  header_image,
  description,
  rich_text,
  code_snippet,
  starred,
  memory_list_key
`;

const MAX_SORT_VALUE = Number.MAX_SAFE_INTEGER;

const toSortableNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : MAX_SORT_VALUE;
};

const getEffectiveTreeSortValue = (item) => {
  if (item?.has_children) {
    return toSortableNumber(item.row_order ?? item.memory_key);
  }

  return toSortableNumber(item?.memory_key ?? item?.row_order);
};

export const compareMemoryTreeItems = (a, b) => {
  const primaryDifference = getEffectiveTreeSortValue(a) - getEffectiveTreeSortValue(b);
  if (primaryDifference !== 0) {
    return primaryDifference;
  }

  const memoryKeyDifference = toSortableNumber(a?.memory_key) - toSortableNumber(b?.memory_key);
  if (memoryKeyDifference !== 0) {
    return memoryKeyDifference;
  }

  const rowOrderDifference = toSortableNumber(a?.row_order) - toSortableNumber(b?.row_order);
  if (rowOrderDifference !== 0) {
    return rowOrderDifference;
  }

  return toSortableNumber(a?.id) - toSortableNumber(b?.id);
};

export const sortMemoryTreeNodes = (nodes = []) =>
  [...nodes]
    .map((node) => ({
      ...node,
      children: Array.isArray(node.children) ? sortMemoryTreeNodes(node.children) : node.children,
    }))
    .sort(compareMemoryTreeItems);

const normalizeSearchValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).toLowerCase();
};

export const isMemoryListNode = (item) => item?.item_type === MEMORY_ITEM_TYPES.LIST;
export const isGroupingNode = (item) => item?.item_type === MEMORY_ITEM_TYPES.GROUP;
export const isFolderNode = (item) =>
  item?.item_type === MEMORY_ITEM_TYPES.FOLDER ||
  item?.item_type === MEMORY_ITEM_TYPES.SPLITTER_FOLDER;
export const isMemoryEntryNode = (item) => item?.item_type === MEMORY_ITEM_TYPES.ITEM;

const buildMemoryItemMap = (items = []) => {
  const itemMap = new Map();

  for (const item of items) {
    itemMap.set(Number(item.id), item);
  }

  return itemMap;
};

const isNodeInsideGroupBranch = (nodeId, itemMap) => {
  const visited = new Set();
  let currentId = Number(nodeId);

  while (Number.isFinite(currentId)) {
    if (visited.has(currentId)) {
      return false;
    }

    visited.add(currentId);
    const currentItem = itemMap.get(currentId);
    if (!currentItem) {
      return false;
    }

    if (currentItem.item_type === MEMORY_ITEM_TYPES.GROUP) {
      return true;
    }

    if (currentItem.parent_id === null || currentItem.parent_id === undefined) {
      return false;
    }

    currentId = Number(currentItem.parent_id);
  }

  return false;
};

const getSubtreeNodeIds = (rootId, itemMap) => {
  const normalizedRootId = Number(rootId);
  if (!Number.isFinite(normalizedRootId)) {
    return new Set();
  }

  const subtreeIds = new Set([normalizedRootId]);
  const stack = [normalizedRootId];

  while (stack.length > 0) {
    const currentId = stack.pop();

    for (const item of itemMap.values()) {
      if (Number(item.parent_id) !== currentId) {
        continue;
      }

      const childId = Number(item.id);
      if (subtreeIds.has(childId)) {
        continue;
      }

      subtreeIds.add(childId);
      stack.push(childId);
    }
  }

  return subtreeIds;
};

const filterGroupedBranchesFromTestableNodes = (items = []) => {
  const itemMap = buildMemoryItemMap(items);

  return items.filter((item) => {
    if (item.item_type === MEMORY_ITEM_TYPES.GROUP) {
      return false;
    }

    if (item.item_type === MEMORY_ITEM_TYPES.LIST) {
      return false;
    }

    const isEligibleTestNode =
      item.item_type === MEMORY_ITEM_TYPES.FOLDER ||
      item.item_type === MEMORY_ITEM_TYPES.SPLITTER_FOLDER ||
      Boolean(item?.is_testable);

    if (!isEligibleTestNode) {
      return false;
    }

    if (item.item_type === MEMORY_ITEM_TYPES.SPLITTER_FOLDER) {
      return false;
    }

    return !isNodeInsideGroupBranch(item.id, itemMap);
  });
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getDefaultNodeTypeForParent = (parentItem) => {
  if (!parentItem) {
    return MEMORY_ITEM_TYPES.GROUP;
  }

  const parentType = parentItem.item_type;
  if (
    parentType === MEMORY_ITEM_TYPES.LIST ||
    parentType === MEMORY_ITEM_TYPES.FOLDER ||
    parentType === MEMORY_ITEM_TYPES.SPLITTER_FOLDER
  ) {
    return MEMORY_ITEM_TYPES.ITEM;
  }

  return MEMORY_ITEM_TYPES.GROUP;
};

const resolveListIdForNode = (parentItem, itemType, insertedId = null) => {
  if (itemType === MEMORY_ITEM_TYPES.LIST) {
    return insertedId;
  }

  if (!parentItem) {
    return null;
  }

  if (parentItem.item_type === MEMORY_ITEM_TYPES.LIST) {
    return toNullableNumber(parentItem.id);
  }

  return toNullableNumber(parentItem.list_id);
};

const resolveIsTestableForNode = (itemType, isTestable) => {
  if (typeof isTestable === 'boolean') {
    return isTestable;
  }

  if (itemType === MEMORY_ITEM_TYPES.ITEM) {
    return true;
  }

  return false;
};

export async function refreshMemoryItemMetadata() {
  const { error } = await supabase.rpc('refresh_memory_item_metadata');
  if (error) {
    console.error('Error refreshing memory item metadata:', error);
    throw error;
  }
}

export async function fetchMemoryItemById(memoryItemId) {
  if (!memoryItemId) {
    return null;
  }

  const { data, error } = await supabase
    .from('memory_items')
    .select(DEFAULT_MEMORY_ITEM_SELECT)
    .eq('id', Number(memoryItemId))
    .maybeSingle();

  if (error) {
    console.error('Error fetching memory item by id:', error);
    throw error;
  }

  return data ?? null;
}

const getNextMemoryListKey = async () => {
  const { data: listKeys, error } = await supabase
    .from('memory_items')
    .select('memory_list_key')
    .not('memory_list_key', 'is', null)
    .order('memory_list_key', { ascending: true });

  if (error) {
    console.error('Error fetching memory list keys:', error);
    throw error;
  }

  let nextMemoryListKey = 0;
  for (const row of listKeys ?? []) {
    const currentKey = Number(row.memory_list_key);
    if (!Number.isInteger(currentKey)) continue;
    if (currentKey < nextMemoryListKey) continue;
    if (currentKey === nextMemoryListKey) {
      nextMemoryListKey += 1;
      continue;
    }
    break;
  }

  return nextMemoryListKey;
};

export async function getOwningListRootId(memoryItemId) {
  if (!memoryItemId) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_memory_item_owner_list_id', {
    p_item_id: Number(memoryItemId),
  });

  if (error) {
    console.error('Error resolving owning list root id:', error);
    throw error;
  }

  return data ?? null;
}

export async function fetchMemoryListRoots(searchTerm = '') {
  let query = supabase
    .from('memory_items')
    .select('id, name')
    .eq('item_type', MEMORY_ITEM_TYPES.LIST)
    .order('name', { ascending: true })
    .limit(50);

  const trimmedSearch = String(searchTerm ?? '').trim();
  if (trimmedSearch) {
    query = query.ilike('name', `%${trimmedSearch}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching memory list roots:', error);
    throw error;
  }

  return data ?? [];
}

export async function getListDescendants(listId) {
  if (!listId) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_memory_list_descendants', {
    p_list_id: Number(listId),
  });

  if (error) {
    console.error('Error fetching list descendants:', error);
    throw error;
  }

  return data ?? [];
}

export async function getTestableNodesForList(listId) {
  if (!listId) {
    return [];
  }

  const descendants = await getListDescendants(listId);

  // Keep tests scoped to the selected logical list and drop any branch that passes through a group.
  return filterGroupedBranchesFromTestableNodes(descendants ?? []);
}

export async function getTestableNodesForSubtree(rootId) {
  if (!rootId) {
    return [];
  }

  const rootItem = await fetchMemoryItemById(rootId);
  if (!rootItem) {
    return [];
  }

  const owningListId = rootItem.item_type === MEMORY_ITEM_TYPES.LIST
    ? Number(rootItem.id)
    : Number(rootItem.list_id);

  if (!Number.isFinite(owningListId)) {
    return [];
  }

  const descendants = await getListDescendants(owningListId);
  const candidateItems = rootItem.item_type === MEMORY_ITEM_TYPES.LIST
    ? descendants
    : [rootItem, ...(descendants ?? [])];
  const itemMap = buildMemoryItemMap(candidateItems);
  const subtreeIds = getSubtreeNodeIds(rootItem.id, itemMap);

  return filterGroupedBranchesFromTestableNodes(candidateItems).filter((item) => {
    if (!subtreeIds.has(Number(item.id))) {
      return false;
    }

    // Preserve the existing behavior where selecting a list root tests its descendants, not the root row itself.
    if (Number(item.id) === Number(rootItem.id) && rootItem.item_type === MEMORY_ITEM_TYPES.LIST) {
      return false;
    }

    return true;
  });
}

export const searchMemoryItemsAdvanced = async (searchString, options = {}) => {
  const searchColumns = Array.isArray(options.columns)
    ? options.columns.filter((column) => ADVANCED_SEARCH_COLUMNS.includes(column))
    : [];

  if (searchColumns.length === 0) {
    return [];
  }

  const term = String(searchString ?? '').trim().toLowerCase();
  if (term.length < 2) {
    return [];
  }

  const selectedListIds = Array.isArray(options.listIds)
    ? options.listIds.map((id) => String(id))
    : [];
  const selectedListSet = new Set(selectedListIds);

  const { data, error } = await supabase
    .from('memory_items')
    .select('id, parent_id, list_id, memory_key, row_order, name, memory_image, header_image, description, rich_text')
    .range(0, 9999);

  if (error) {
    console.error('Error fetching memory items for advanced search:', error);
    return [];
  }

  const rows = data ?? [];
  const filtered = rows.filter((row) => {
    if (term.length > 0) {
      const hasMatch = searchColumns.some((column) => normalizeSearchValue(row[column]).includes(term));
      if (!hasMatch) {
        return false;
      }
    }

    if (selectedListSet.size === 0) {
      return true;
    }

    const rowRootListId = row.list_id === null || row.list_id === undefined ? null : String(row.list_id);
    if (rowRootListId === null) {
      return false;
    }

    return selectedListSet.has(rowRootListId);
  });

  return filtered;
};

export const fetchRootItems = async (singleListViewId = null) => {
  if (singleListViewId !== null && singleListViewId !== undefined && singleListViewId !== '') {
    const listId = Number(singleListViewId);
    if (!Number.isFinite(listId)) {
      return [];
    }

    // Single list view can target any list, including nested ones, so load the
    // requested row directly from the tree view with its child metadata.
    const { data, error } = await supabase
      .from('memory_tree_with_starred')
      .select('*')
      .eq('id', listId)
      .maybeSingle();

    if (error) {
      console.log("Error: fetchRootItems failed: Reason = ", error);
      return [];
    }

    return data ? [data] : [];
  }

  const { data, error } = await supabase
    .rpc('get_root_memory_items');

  if(error){
    console.log("Error: fetchRootItems failed: Reason = ", error);
    return [];
  }else{
    return data ?? [];
  }
}

export async function fetchChildren(parentId) {
  console.log("fetchChildren");
  const { data, error } = await supabase.rpc('get_children', {
    p_parent_id: Number(parentId),
  });
  if (error) {
     console.log("Error: fetchChildren failed: Reason = ", error);
    throw error;
  }
  else{
    console.log("fetchChildren successful: ", data);
    return data;
  }
 
}


// Use this call when searching to to load the full path
export async function fetchChildrenWithPath(focusId) {
  const { data, error } = await supabase.rpc('get_children_with_path', {
    p_focus_id: Number(focusId),
  });
  if (error) throw error;
  return data;
}


// Fetch memory tree data from Supabase, order it by integer memory_key, and structure it as a nested tree
// This function returns the entire table which is too much. Now using fetchRootItems
export const fetchMemoryTree = async () => {

  const { data, error } = await supabase
    .from('memory_tree_with_starred')
    .select('*')
    .range(0, 9999); // Can now exceed 1000 safely

  if (error) {
    console.error("Error fetching memory tree view:", error);
    return [];
  }

  console.log("fetchMemoryTree rows = ", data.length);

  // Sort rows using the same tree ordering rule used by the UI.
  data.sort((a, b) => {
    if (a.parent_id === null && b.parent_id !== null) return -1;
    if (a.parent_id !== null && b.parent_id === null) return 1;
    if (a.parent_id === b.parent_id) {
      return compareMemoryTreeItems(a, b);
    }
    return 0;
  });

  const dataMap = {};
  data.forEach((item) => {
    dataMap[item.id] = { ...item, children: [] };
  });

  //console.log("dataMap = ", dataMap);

  const nestedData = [];
  data.forEach((item) => {
    if (item.parent_id === null) {
      nestedData.push(dataMap[item.id]);
    } else if (dataMap[item.parent_id]) {
      dataMap[item.parent_id].children.push(dataMap[item.id]);
    }
  });

  //console.log("nestedData = ", nestedData);

  return nestedData;
};

// // Fetch memory tree data from Supabase, order it, and structure it as a nested tree
// export const fetchMemoryTree = async () => {
//     const { data, error } = await supabase.rpc('fetch_memory_tree');
//     if (error) {
//       console.error("Error fetching memory tree:", error);
//       return [];
//     }

//     // Sort data with null parent_id items first, ordered by memory_key
//     data.sort((a, b) => {
//       if (a.parent_id === null && b.parent_id !== null) return -1;
//       if (a.parent_id !== null && b.parent_id === null) return 1;
//       if (a.parent_id === b.parent_id) {
//         return a.memory_key.localeCompare(b.memory_key);
//       }
//       return 0;
//     });

//     const dataMap = {};
//     data.forEach((item) => {
//       dataMap[item.id] = { ...item, children: [] };
//     });

//     const nestedData = [];
//     data.forEach((item) => {
//       if (item.parent_id === null) {
//         nestedData.push(dataMap[item.id]);
//       } else if (dataMap[item.parent_id]) {
//         dataMap[item.parent_id].children.push(dataMap[item.id]);
//       }
//     });

//     return nestedData;
//   };


// Fetch memory tree data from Supabase and structure it as a nested tree
export const fetchMemoryTreeOriginal = async () => {
  const { data, error } = await supabase.rpc('fetch_memory_tree');
  if (error) {
    console.error("Error fetching memory tree:", error);
    return [];
  }

  const dataMap = {};
  data.forEach((item) => {
    dataMap[item.id] = { ...item, children: [] };
  });

  const nestedData = [];
  data.forEach((item) => {
    if (item.parent_id === null) {
      nestedData.push(dataMap[item.id]);
    } else if (dataMap[item.parent_id]) {
      dataMap[item.parent_id].children.push(dataMap[item.id]);
    }
  });

  return nestedData;
};

// Update the starred status of an item
export const updateStarred = async (memoryId, starredStatus) => {
  console.log("updateStarred", memoryId, starredStatus)

  try {
    const { error } = await supabase
      .from('memory_items')
      .update({ starred: starredStatus })
      .eq('id', memoryId);

    if (error) throw error;
  } catch (err) {
    console.log("Error updating starred item");
  }
}

export const updateMemoryItemParent = async (draggedItemIds, newParentId) => {
  try {
    const ids = Array.isArray(draggedItemIds) ? draggedItemIds : [draggedItemIds];
    const normalizedIds = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    const normalizedParentId = toNullableNumber(newParentId);

    if (normalizedParentId !== null && normalizedIds.includes(normalizedParentId)) {
      console.error("Cannot drop an item onto itself.");
      return;
    }

    console.log("Updating parent_id =", normalizedParentId, "for ids =", normalizedIds);

    const { error } = await supabase.rpc('move_memory_items', {
      p_item_ids: normalizedIds,
      p_new_parent_id: normalizedParentId,
    });

    if (error) throw error;
  } catch (err) {
    console.error("Error updating memory item(s):", err);
    throw err;
  }
};


// // Update the parent_id of a memory item (drag and drop logic)
// export const updateMemoryItemParent = async (draggedItemId, newParentId) => {
//   try {
//     if (draggedItemId === newParentId) {
//       console.error("Cannot drop an item onto itself.");
//       return;
//     }

//     console.log("update parent id = ", newParentId, " where id = ", draggedItemId);
//     const { error } = await supabase
//       .from('memory_items')
//       .update({ parent_id: newParentId })
//       .eq('id', draggedItemId);

//     if (error) throw error;
//   } catch (err) {
//     console.error("Error updating memory item:", err);
//   }
// };

// Update a memory item in Supabase (for the edit form)
export const updateMemoryItem = async (id, memory_key, row_order, name, memory_image, header_image, code_snippet, description, rich_text) => {
  const { data, error } = await supabase
    .from('memory_items')
    .update({ memory_key, row_order, name, memory_image, header_image, code_snippet, description, rich_text })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error("Error updating memory item:", error);
    return null;
  } else {
    console.log("Item updated successfully!");
    return data;
  }
};

export const createMemoryNode = async ({
  parentId = null,
  name = 'New Child Item',
  itemType,
  isTestable,
  memoryKey = null,
  rowOrder = null,
}) => {
  const normalizedParentId = toNullableNumber(parentId);
  const parentItem = normalizedParentId ? await fetchMemoryItemById(normalizedParentId) : null;
  const resolvedItemType = itemType ?? getDefaultNodeTypeForParent(parentItem);

  let keyQuery = supabase
    .from('memory_items')
    .select('memory_key')
    .order('memory_key', { ascending: false })
    .limit(1);

  if (normalizedParentId === null) {
    keyQuery = keyQuery.is('parent_id', null);
  } else {
    keyQuery = keyQuery.eq('parent_id', normalizedParentId);
  }

  const { data: highestMemoryKeyData, error: highestMemoryKeyError } = await keyQuery;
  if (highestMemoryKeyError) {
    console.error('Error fetching highest memory key:', highestMemoryKeyError);
    throw highestMemoryKeyError;
  }

  const nextMemoryKey = memoryKey ?? (
    highestMemoryKeyData && highestMemoryKeyData.length > 0
      ? Number(highestMemoryKeyData[0].memory_key) + 1
      : 0
  );
  const nextRowOrder = rowOrder ?? nextMemoryKey;

  let nextMemoryListKey = null;
  if (resolvedItemType === MEMORY_ITEM_TYPES.LIST) {
    nextMemoryListKey = await getNextMemoryListKey();
  }

  const { error, data: newItem } = await supabase
    .from('memory_items')
    .insert([{
      name,
      parent_id: normalizedParentId,
      memory_key: nextMemoryKey,
      row_order: nextRowOrder,
      memory_image: '',
      header_image: '',
      rich_text: '',
      item_type: resolvedItemType,
      list_id: resolveListIdForNode(parentItem, resolvedItemType),
      is_testable: resolveIsTestableForNode(resolvedItemType, isTestable),
      memory_list_key: nextMemoryListKey,
    }])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating memory node:', error);
    throw error;
  }

  if (resolvedItemType === MEMORY_ITEM_TYPES.LIST) {
    const { error: listUpdateError, data: updatedItem } = await supabase
      .from('memory_items')
      .update({
        list_id: newItem.id,
        is_testable: false,
      })
      .eq('id', newItem.id)
      .select('*')
      .single();

    if (listUpdateError) {
      console.error('Error finalizing new list node:', listUpdateError);
      throw listUpdateError;
    }

    await refreshMemoryItemMetadata();
    return updatedItem;
  }

  await refreshMemoryItemMetadata();
  return newItem;
};

export const createNewMemoryList = async () => {
  try {
    const newItem = await createMemoryNode({
      parentId: null,
      name: 'New Memory List',
      itemType: MEMORY_ITEM_TYPES.LIST,
      isTestable: false,
    });

    return newItem?.id ?? null;


    let highestMemoryKey = 0;

    // Step 1: Query for the rows where parent_id matches and order by memory_key descending
    const { data: highestMemoryKeyData, error: highestMemoryKeyError } = await supabase
      .from('memory_items')
      .select('memory_key')
      .is('parent_id', null)
      .order('memory_key', { ascending: false })  // Order by memory_key in descending order
      .limit(1);  // Limit to only the row with the highest memory_key


    highestMemoryKey = highestMemoryKeyData && highestMemoryKeyData.length > 0
      ? highestMemoryKeyData[0].memory_key + 1  // Increment the highest key
      : 0;

    console.log("New List Memory Key = ", highestMemoryKey, highestMemoryKeyData)
    if (highestMemoryKeyError) {
      throw new Error("Error fetching highest memory_key: " + highestMemoryKeyError.message);
    }

    const { error, data: legacyNewItem } = await supabase
      .from('memory_items')
      .insert([{
        name: 'New Memory List',
        memory_key: highestMemoryKey,  // Use the new memory_key
        row_order: highestMemoryKey,
        memory_image: '',
        header_image: '',
        rich_text: '',
      }])
      .select() // 👈 This tells Supabase to return the inserted row
      .single();

    console.log('newItem inserted = ', legacyNewItem);

    if (error) {
      console.error("Error creating new Memory List:", error);
    } else {
      return legacyNewItem.id;
    }

  } catch (err) {
    console.error("Error in createNewMemoryList:", err);
    throw err;
  }
};

export const addToRevisionList = async (memoryListIndex, subListIndex = null, memoryKey = null) => {
  const { data, error } = await supabase
    .from('revision_lists')
    .insert([
      {
        list_index: memoryListIndex,   // required
        sub_list_index: subListIndex,  // optional
        item_memory_key: memoryKey     // optional
      }
    ])
    .select() // return inserted row(s)

  if (error) {
    console.error('Insert error:', error)
    return null
  }

  return data
}

export const deleteRevisionList = async (memoryListIndex, subListIndex = null) => {
  const { data, error } = await supabase
    .from("revision_lists")
    .delete()
    .match({
      list_index: memoryListIndex,
      sub_list_index: subListIndex === null ? -1 : subListIndex,
    });

  if (error) {
    console.error("Error deleting revision list:", error);
    throw error;
  }

  console.log("Deleted rows:", data);
  return data;
}

export const insertMultipleItems = async (parentId, amountOfItems) => {

    if(!parentId)
    {
      alert("Invalid ParentId");
      return [];
    }

    try {

      const parentItem = await fetchMemoryItemById(parentId);
      let highestMemoryKey = 0;
      console.log("insertMultipleItems parentId", parentId)

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
        throw new Error("insertMultipleItems - Error fetching highest memory_key: " + highestMemoryKeyError.message);
      }


      // Step 2: Determine the new memory_key value
      const newMemoryKey = highestMemoryKey++; 

      // Step 3: Insert the new child item with the new memory_key

        // New query
        const resolvedItemType = getDefaultNodeTypeForParent(parentItem);
        const records = Array.from({ length: amountOfItems }, (_, i) => ({
          name: `New Child Item ${i + 1}`,
          memory_key: newMemoryKey + i,  // 👈 incrementing
          row_order: newMemoryKey + i,
          memory_image: '',
          header_image: '',
          rich_text: '',
          parent_id: parentId,
          item_type: resolvedItemType,
          list_id: resolveListIdForNode(parentItem, resolvedItemType),
          is_testable: resolveIsTestableForNode(resolvedItemType),
        }));

        const { data, error } = await supabase
          .from('memory_items')
          .insert(records)
          .select(); // returns all inserted rows

      if (error) {
        console.error("insertMultipleItems - Error creating new child item:", error);
        throw error;
      } else {
        await refreshMemoryItemMetadata();
        console.log('Inserted:', data);
        return data;
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }

  return [];
  };

export const updateMemoryItemType = async (memoryItemId, nextItemType) => {
  const normalizedId = Number(memoryItemId);
  const allowedTypes = Object.values(MEMORY_ITEM_TYPES);

  if (!Number.isFinite(normalizedId)) {
    throw new Error('Invalid memory item id.');
  }

  if (!allowedTypes.includes(nextItemType)) {
    throw new Error(`Unsupported item type: ${nextItemType}`);
  }

  const currentItem = await fetchMemoryItemById(normalizedId);
  if (!currentItem) {
    throw new Error(`Memory item ${memoryItemId} was not found.`);
  }

  const updatePayload = {
    item_type: nextItemType,
    list_id: currentItem.list_id,
    is_testable: currentItem.is_testable,
    memory_list_key: currentItem.memory_list_key,
  };

  if (nextItemType === MEMORY_ITEM_TYPES.LIST) {
    updatePayload.list_id = normalizedId;
    updatePayload.is_testable = false;
    updatePayload.memory_list_key =
      currentItem.memory_list_key ?? await getNextMemoryListKey();
  } else {
    updatePayload.memory_list_key = null;

    if (nextItemType === MEMORY_ITEM_TYPES.GROUP) {
      updatePayload.list_id = null;
      updatePayload.is_testable = false;
    } else if (nextItemType === MEMORY_ITEM_TYPES.SPLITTER_FOLDER) {
      updatePayload.is_testable = false;
    } else if (nextItemType === MEMORY_ITEM_TYPES.ITEM) {
      updatePayload.is_testable = true;
    }
  }

  const { data, error } = await supabase
    .from('memory_items')
    .update(updatePayload)
    .eq('id', normalizedId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating memory item type:', error);
    throw error;
  }

  if (nextItemType === MEMORY_ITEM_TYPES.LIST || currentItem.item_type === MEMORY_ITEM_TYPES.LIST) {
    await refreshMemoryItemMetadata();
  }

  return data;
};

export const toggleMemoryList = async (id, bSet) => {
  try {
    if (!bSet) {
      await updateMemoryItemType(id, MEMORY_ITEM_TYPES.GROUP);
      return null;
    }
    const updatedItem = await updateMemoryItemType(id, MEMORY_ITEM_TYPES.LIST);
    return updatedItem?.memory_list_key ?? null;
  } catch (err) {
    console.error("Error in toggleMemoryList:", err);
    return null;
  }
};

