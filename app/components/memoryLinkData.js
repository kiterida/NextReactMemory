import { supabase } from './supabaseClient';
import {
  fetchMemoryItemById,
  refreshMemoryItemMetadata,
  MEMORY_ITEM_TYPES,
  normalizeMemorySortMode,
} from './memoryData';

const DISPLAYED_LINK_SELECT = `
  id,
  parent_item_id,
  child_item_id,
  memory_key,
  created_at
`;

const DISPLAYED_CHILD_ITEM_SELECT = `
  id,
  parent_id,
  list_id,
  item_type,
  sort_mode,
  is_locked,
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

let hasWarnedAboutDescendantCountFallback = false;

const mapDisplayedLinkRow = (row, childRow) => ({
  ...childRow,
  parent_id: row.parent_item_id,
  source_item_id: row.child_item_id,
  source_parent_id: childRow?.parent_id ?? null,
  link_id: row.id,
  is_linked: true,
  memory_key: row.memory_key,
  row_order: row.memory_key,
  created_at: row.created_at,
});

const hydrateLinkRows = async (rows = []) => {
  if (!rows.length) {
    return [];
  }

  const childIds = Array.from(new Set(rows.map((row) => Number(row.child_item_id)).filter(Number.isFinite)));
  const { data: childRows, error } = await supabase
    .from('memory_items')
    .select(DISPLAYED_CHILD_ITEM_SELECT)
    .in('id', childIds);

  if (error) {
    console.error('Error hydrating linked memory items:', error);
    throw error;
  }

  const childMap = new Map((childRows ?? []).map((childRow) => [Number(childRow.id), childRow]));
  return rows
    .map((row) => {
      const childRow = childMap.get(Number(row.child_item_id));
      if (!childRow) {
        return null;
      }

      return mapDisplayedLinkRow(row, childRow);
    })
    .filter(Boolean);
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRequiredInteger = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }

  return parsed;
};

const formatSupabaseError = (error, fallbackMessage) => {
  if (!error) {
    return fallbackMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  const pieces = [error.message, error.details, error.hint, error.code]
    .filter((piece) => typeof piece === 'string' && piece.trim().length > 0);

  if (pieces.length > 0) {
    return pieces.join(' | ');
  }

  try {
    return JSON.stringify(error);
  } catch (_jsonError) {
    return fallbackMessage;
  }
};

const getDefaultNodeTypeForParent = (parentItem) => {
  if (!parentItem) {
    return MEMORY_ITEM_TYPES.GROUP;
  }

  return MEMORY_ITEM_TYPES.ITEM;
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

  return itemType === MEMORY_ITEM_TYPES.ITEM;
};

export async function isMemoryKeyAvailableInParent(parentItemId, memoryKey, options = {}) {
  const normalizedParentId = toNullableNumber(parentItemId);
  const normalizedMemoryKey = toRequiredInteger(memoryKey, 'Memory key');

  if (normalizedParentId === null) {
    return true;
  }

  const { data, error } = await supabase.rpc('is_memory_key_available_in_parent', {
    p_parent_item_id: normalizedParentId,
    p_memory_key: normalizedMemoryKey,
    p_exclude_item_id: toNullableNumber(options.excludeItemId),
    p_exclude_link_id: toNullableNumber(options.excludeLinkId),
  });

  if (error) {
    console.error('Error checking memory key availability:', error);
    throw error;
  }

  return Boolean(data);
}

export async function assertMemoryKeyAvailableInParent(parentItemId, memoryKey, options = {}) {
  const isAvailable = await isMemoryKeyAvailableInParent(parentItemId, memoryKey, options);
  if (!isAvailable) {
    throw new Error(`memory_key ${memoryKey} is already used in this parent.`);
  }
}

export async function getNextMemoryKeyForParent(parentItemId) {
  const normalizedParentId = toNullableNumber(parentItemId);

  let directQuery = supabase
    .from('memory_items')
    .select('memory_key')
    .order('memory_key', { ascending: false })
    .limit(1);

  if (normalizedParentId === null) {
    directQuery = directQuery.is('parent_id', null);
  } else {
    directQuery = directQuery.eq('parent_id', normalizedParentId);
  }

  const linkQuery = normalizedParentId === null
    ? Promise.resolve({ data: [], error: null })
    : supabase
        .from('memory_item_links')
        .select('memory_key')
        .eq('parent_item_id', normalizedParentId)
        .order('memory_key', { ascending: false })
        .limit(1);

  const [{ data: directRows, error: directError }, { data: linkRows, error: linkError }] = await Promise.all([
    directQuery,
    linkQuery,
  ]);

  if (directError) {
    console.error('Error fetching direct memory keys:', directError);
    throw directError;
  }

  if (linkError) {
    console.error('Error fetching linked memory keys:', linkError);
    throw linkError;
  }

  const highestDirect = Number(directRows?.[0]?.memory_key);
  const highestLink = Number(linkRows?.[0]?.memory_key);
  const candidates = [highestDirect, highestLink].filter(Number.isFinite);
  if (candidates.length === 0) {
    return 0;
  }

  return Math.max(...candidates) + 1;
}

export async function getMemoryItemLinksByParent(parentItemId) {
  const normalizedParentId = toRequiredInteger(parentItemId, 'Parent item id');
  const { data, error } = await supabase
    .from('memory_item_links')
    .select(DISPLAYED_LINK_SELECT)
    .eq('parent_item_id', normalizedParentId)
    .order('memory_key', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching memory item links:', error);
    throw error;
  }

  return hydrateLinkRows(data ?? []);
}

export async function getMemoryItemLinkById(linkId) {
  const normalizedLinkId = toRequiredInteger(linkId, 'Link id');
  const { data, error } = await supabase
    .from('memory_item_links')
    .select(DISPLAYED_LINK_SELECT)
    .eq('id', normalizedLinkId)
    .single();

  if (error) {
    console.error('Error fetching memory item link by id:', error);
    throw error;
  }

  const hydratedRows = await hydrateLinkRows(data ? [data] : []);
  return hydratedRows[0] ?? null;
}

export async function insertMemoryItemLink(parentItemId, childItemId, memoryKey) {
  const normalizedParentId = toRequiredInteger(parentItemId, 'Parent item id');
  const normalizedChildId = toRequiredInteger(childItemId, 'Child item id');
  const normalizedMemoryKey = toRequiredInteger(memoryKey, 'Memory key');

  if (normalizedParentId === normalizedChildId) {
    throw new Error('A memory item cannot be linked into itself.');
  }

  const { data: sourceItem, error: sourceItemError } = await supabase
    .from('memory_items')
    .select('id, parent_id, list_id, item_type, sort_mode, is_locked, is_testable, name, description, rich_text, code_snippet, memory_image, header_image, starred, memory_list_key')
    .eq('id', normalizedChildId)
    .maybeSingle();

  if (sourceItemError) {
    console.error('Error loading source item before linking:', sourceItemError);
    throw new Error(formatSupabaseError(sourceItemError, 'Failed to load the source memory item.'));
  }

  if (!sourceItem) {
    throw new Error('The source memory item was not found.');
  }

  if (Number(sourceItem.parent_id) === normalizedParentId) {
    throw new Error('That memory item already exists as a direct child in this parent.');
  }

  await assertMemoryKeyAvailableInParent(normalizedParentId, normalizedMemoryKey);

  const { data: insertedLink, error } = await supabase
    .from('memory_item_links')
    .insert({
      parent_item_id: normalizedParentId,
      child_item_id: normalizedChildId,
      memory_key: normalizedMemoryKey,
    })
    .select('id, parent_item_id, child_item_id, memory_key, created_at')
    .single();

  if (error) {
    const formattedMessage = formatSupabaseError(error, 'Failed to insert memory item link.');
    console.error('Error inserting memory item link:', {
      parentItemId: normalizedParentId,
      childItemId: normalizedChildId,
      memoryKey: normalizedMemoryKey,
      formattedMessage,
      rawError: error,
    });
    throw new Error(formattedMessage);
  }

  try {
    return await getMemoryItemLinkById(insertedLink.id);
  } catch (hydrateError) {
    console.error('Error hydrating memory item link after insert:', hydrateError);
    return {
      id: String(insertedLink.id),
      parent_id: insertedLink.parent_item_id,
      source_item_id: insertedLink.child_item_id,
      source_parent_id: sourceItem.parent_id ?? null,
      link_id: insertedLink.id,
      is_linked: true,
      memory_key: insertedLink.memory_key,
      row_order: insertedLink.memory_key,
      created_at: insertedLink.created_at,
      name: sourceItem.name,
      description: sourceItem.description,
      rich_text: sourceItem.rich_text,
      code_snippet: sourceItem.code_snippet,
      memory_image: sourceItem.memory_image,
      header_image: sourceItem.header_image,
      starred: sourceItem.starred,
      memory_list_key: sourceItem.memory_list_key,
      list_id: sourceItem.list_id,
      item_type: sourceItem.item_type,
      is_testable: sourceItem.is_testable,
    };
  };
}

export async function updateMemoryItemLinkMemoryKey(linkId, memoryKey) {
  const normalizedLinkId = toRequiredInteger(linkId, 'Link id');
  const normalizedMemoryKey = toRequiredInteger(memoryKey, 'Memory key');

  const { data: existingLink, error: loadError } = await supabase
    .from('memory_item_links')
    .select('id, parent_item_id, child_item_id')
    .eq('id', normalizedLinkId)
    .single();

  if (loadError) {
    console.error('Error loading memory item link:', loadError);
    throw loadError;
  }

  await assertMemoryKeyAvailableInParent(existingLink.parent_item_id, normalizedMemoryKey, {
    excludeLinkId: normalizedLinkId,
  });

  const { data, error } = await supabase
    .from('memory_item_links')
    .update({ memory_key: normalizedMemoryKey })
    .eq('id', normalizedLinkId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating memory item link memory key:', error);
    throw error;
  }

  return data;
}

export async function moveMemoryItemLink(linkId, newParentItemId) {
  const normalizedLinkId = toRequiredInteger(linkId, 'Link id');
  const normalizedParentId = toRequiredInteger(newParentItemId, 'Parent item id');

  const { data: existingLink, error: loadError } = await supabase
    .from('memory_item_links')
    .select('id, parent_item_id, child_item_id')
    .eq('id', normalizedLinkId)
    .single();

  if (loadError) {
    console.error('Error loading memory item link for move:', loadError);
    throw loadError;
  }

  if (Number(existingLink.child_item_id) === normalizedParentId) {
    throw new Error('A memory item cannot be linked into itself.');
  }

  const nextMemoryKey = await getNextMemoryKeyForParent(normalizedParentId);
  await assertMemoryKeyAvailableInParent(normalizedParentId, nextMemoryKey, {
    excludeLinkId: normalizedLinkId,
  });

  const { data, error } = await supabase
    .from('memory_item_links')
    .update({
      parent_item_id: normalizedParentId,
      memory_key: nextMemoryKey,
    })
    .eq('id', normalizedLinkId)
    .select('*')
    .single();

  if (error) {
    console.error('Error moving memory item link:', error);
    throw error;
  }

  await refreshMemoryItemMetadata();
  return data;
}

export async function deleteMemoryItemLink(linkId) {
  const normalizedLinkId = toRequiredInteger(linkId, 'Link id');
  const { error } = await supabase
    .from('memory_item_links')
    .delete()
    .eq('id', normalizedLinkId);

  if (error) {
    console.error('Error deleting memory item link:', error);
    throw error;
  }
}

export async function searchLinkableMemoryItems(searchString) {
  const trimmedSearch = String(searchString ?? '').trim();

  let query = supabase
    .from('memory_items')
    .select('id, parent_id, list_id, item_type, is_locked, name, description, memory_key')
    .order('name', { ascending: true })
    .limit(50);

  if (trimmedSearch.length >= 2) {
    query = query.or(
      `name.ilike.%${trimmedSearch}%,description.ilike.%${trimmedSearch}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error searching linkable memory items:', error);
    throw error;
  }

  return data ?? [];
}

export async function createMemoryNodeWithSharedOrdering({
  parentId = null,
  name = 'New Child Item',
  itemType,
  isTestable,
  memoryKey = null,
  rowOrder = null,
}) {
  const normalizedParentId = toNullableNumber(parentId);
  const parentItem = normalizedParentId ? await fetchMemoryItemById(normalizedParentId) : null;
  const resolvedItemType = itemType ?? getDefaultNodeTypeForParent(parentItem);
  const nextMemoryKey = memoryKey ?? await getNextMemoryKeyForParent(normalizedParentId);
  const nextRowOrder = rowOrder ?? nextMemoryKey;

  if (normalizedParentId !== null) {
    await assertMemoryKeyAvailableInParent(normalizedParentId, nextMemoryKey);
  }

  const { error, data } = await supabase
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
    }])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating shared-order memory node:', error);
    throw error;
  }

  if (parentItem?.item_type === MEMORY_ITEM_TYPES.ITEM) {
    const { error: parentTypeUpdateError } = await supabase
      .from('memory_items')
      .update({
        item_type: MEMORY_ITEM_TYPES.FOLDER,
      })
      .eq('id', Number(parentItem.id));

    if (parentTypeUpdateError) {
      console.error('Error promoting parent item to folder:', parentTypeUpdateError);
      throw parentTypeUpdateError;
    }
  }

  await refreshMemoryItemMetadata();
  return data;
}

export async function saveMemoryAppearance(selectedItem) {
  const sourceItemId = toRequiredInteger(
    selectedItem.source_item_id ?? selectedItem.id,
    'Source item id'
  );
  const displayMemoryKey = toRequiredInteger(selectedItem.memory_key, 'Memory key');
  const sourceParentId = toNullableNumber(selectedItem.source_parent_id ?? selectedItem.parent_id);

  if (selectedItem.is_linked) {
    await updateMemoryItemLinkMemoryKey(selectedItem.link_id, displayMemoryKey);
  } else if (sourceParentId !== null) {
    await assertMemoryKeyAvailableInParent(sourceParentId, displayMemoryKey, {
      excludeItemId: sourceItemId,
    });
  }

  const updatePayload = {
    memory_key: selectedItem.is_linked ? undefined : displayMemoryKey,
    row_order: selectedItem.is_linked ? undefined : toNullableNumber(selectedItem.row_order),
    name: selectedItem.name,
    memory_image: selectedItem.memory_image,
    header_image: selectedItem.header_image,
    code_snippet: selectedItem.code_snippet,
    description: selectedItem.description,
    rich_text: selectedItem.rich_text,
    sort_mode: selectedItem.is_linked ? undefined : normalizeMemorySortMode(selectedItem.sort_mode),
  };

  const cleanedPayload = Object.fromEntries(
    Object.entries(updatePayload).filter(([, value]) => value !== undefined)
  );

  const { data: sourceItem, error } = await supabase
    .from('memory_items')
    .update(cleanedPayload)
    .eq('id', sourceItemId)
    .select('*')
    .single();

  if (error) {
    console.error('Error saving memory appearance:', error);
    throw error;
  }

  return {
    sourceItem,
    displayMemoryKey,
    displayRowOrder: selectedItem.is_linked ? displayMemoryKey : sourceItem.row_order,
  };
}

export async function countDirectDescendants(itemId) {
  const normalizedItemId = toRequiredInteger(itemId, 'Item id');

  const { data, error } = await supabase.rpc('count_memory_item_descendants', {
    p_item_id: normalizedItemId,
  });

  if (!error) {
    return Number(data ?? 0);
  }

  const formattedRpcError = formatSupabaseError(error, '');
  if (
    !hasWarnedAboutDescendantCountFallback &&
    formattedRpcError &&
    formattedRpcError !== '{}'
  ) {
    console.warn(
      `count_memory_item_descendants RPC unavailable, falling back to client walk: ${formattedRpcError}`
    );
    hasWarnedAboutDescendantCountFallback = true;
  }

  let total = 0;
  const walk = async (id) => {
    const { data: rows, error: walkError } = await supabase
      .from('memory_items')
      .select('id')
      .eq('parent_id', id);

    if (walkError) {
      throw walkError;
    }

    const children = rows ?? [];
    total += children.length;

    for (const child of children) {
      await walk(child.id);
    }
  };

  await walk(normalizedItemId);
  return total;
}

export async function deleteDirectMemoryItemTree(itemId) {
  const normalizedItemId = toRequiredInteger(itemId, 'Item id');

  const { error } = await supabase.rpc('delete_memory_item_tree', {
    p_item_id: normalizedItemId,
  });

  if (error) {
    console.error('Error deleting memory item tree:', error);
    throw error;
  }
}


