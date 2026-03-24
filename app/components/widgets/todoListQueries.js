'use client';

import { supabase } from '../supabaseClient';
import { sortTodoItems, sortTodoTags } from './todoListUtils';

const TODO_LIST_COLUMNS = `
  id,
  created_at,
  updated_at,
  name,
  memory_item_id
`;

const TODO_TAG_COLUMNS = `
  id,
  created_at,
  updated_at,
  todo_list_id,
  name,
  color,
  display_order
`;

const TODO_ITEM_COLUMNS = `
  id,
  created_at,
  updated_at,
  todo_list_id,
  name,
  due_date,
  priority,
  item_order,
  is_completed
`;

function mapTodoTag(tag) {
  if (!tag) {
    return null;
  }

  return {
    ...tag,
    color: tag.color || null,
  };
}

function mapTodoItemResult(data) {
  if (!data) {
    return null;
  }

  const tags = sortTodoTags(
    (data.item_tags ?? [])
      .map((link) => mapTodoTag(link.tag))
      .filter(Boolean)
  );

  return {
    ...data,
    tags,
    tagIds: tags.map((tag) => tag.id),
  };
}

function mapTodoListResult(data) {
  if (!data) {
    return null;
  }

  return {
    ...data,
    tags: sortTodoTags((data.tags ?? []).map(mapTodoTag).filter(Boolean)),
    items: sortTodoItems((data.items ?? []).map(mapTodoItemResult).filter(Boolean)),
  };
}

export async function getTodoTags(todoListId) {
  if (!todoListId) {
    return [];
  }

  const { data, error } = await supabase
    .from('memory_core_todo_tags')
    .select(TODO_TAG_COLUMNS)
    .eq('todo_list_id', todoListId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching todo tags:', error);
    throw error;
  }

  return sortTodoTags((data ?? []).map(mapTodoTag).filter(Boolean));
}

export async function createTodoTag(todoListId, name, color = null) {
  if (!todoListId) {
    throw new Error('A todo list is required to create a tag.');
  }

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Tag name is required.');
  }

  const existingTags = await getTodoTags(todoListId);
  const payload = {
    todo_list_id: todoListId,
    name: trimmedName,
    color: color || null,
    display_order: existingTags.length,
  };

  const { data, error } = await supabase
    .from('memory_core_todo_tags')
    .insert(payload)
    .select(TODO_TAG_COLUMNS)
    .single();

  if (error) {
    console.error('Error creating todo tag:', error);
    throw error;
  }

  return mapTodoTag(data);
}

export async function updateTodoTag(todoTagId, { name, color = null } = {}) {
  if (!todoTagId) {
    throw new Error('A tag is required to update it.');
  }

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Tag name is required.');
  }

  const payload = {
    name: trimmedName,
    color: color || null,
  };

  const { data, error } = await supabase
    .from('memory_core_todo_tags')
    .update(payload)
    .eq('id', todoTagId)
    .select(TODO_TAG_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating todo tag:', error);
    throw error;
  }

  return mapTodoTag(data);
}

export async function deleteTodoTag(todoTagId) {
  if (!todoTagId) {
    throw new Error('A tag is required to delete it.');
  }

  const { error } = await supabase
    .from('memory_core_todo_tags')
    .delete()
    .eq('id', todoTagId);

  if (error) {
    console.error('Error deleting todo tag:', error);
    throw error;
  }
}

export async function getTodoItemTags(todoItemId) {
  if (!todoItemId) {
    return [];
  }

  const { data, error } = await supabase
    .from('memory_core_todo_item_tags')
    .select(`
      todo_tag_id,
      tag:memory_core_todo_tags(${TODO_TAG_COLUMNS})
    `)
    .eq('todo_item_id', todoItemId);

  if (error) {
    console.error('Error fetching todo item tags:', error);
    throw error;
  }

  return sortTodoTags((data ?? []).map((link) => mapTodoTag(link.tag)).filter(Boolean));
}

export async function setTodoItemTags(todoItemId, tagIds) {
  if (!todoItemId) {
    return [];
  }

  const uniqueTagIds = [...new Set((tagIds ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];

  const { error: deleteError } = await supabase
    .from('memory_core_todo_item_tags')
    .delete()
    .eq('todo_item_id', todoItemId);

  if (deleteError) {
    console.error('Error clearing todo item tags:', deleteError);
    throw deleteError;
  }

  if (uniqueTagIds.length > 0) {
    const { error: insertError } = await supabase
      .from('memory_core_todo_item_tags')
      .insert(uniqueTagIds.map((todoTagId) => ({
        todo_item_id: todoItemId,
        todo_tag_id: todoTagId,
      })));

    if (insertError) {
      console.error('Error saving todo item tags:', insertError);
      throw insertError;
    }
  }

  return getTodoItemTags(todoItemId);
}

export async function createTodoList({ name, memoryItemId = null }) {
  const payload = {
    name: String(name || '').trim(),
    memory_item_id: memoryItemId || null,
  };

  const { data, error } = await supabase
    .from('memory_core_todo_lists')
    .insert(payload)
    .select(TODO_LIST_COLUMNS)
    .single();

  if (error) {
    console.error('Error creating todo list:', error);
    throw error;
  }

  return data;
}

export async function updateTodoList(todoListId, { name, memoryItemId = null }) {
  const payload = {
    name: String(name || '').trim(),
    memory_item_id: memoryItemId || null,
  };

  const { data, error } = await supabase
    .from('memory_core_todo_lists')
    .update(payload)
    .eq('id', todoListId)
    .select(TODO_LIST_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating todo list:', error);
    throw error;
  }

  return data;
}

export async function deleteTodoList(todoListId) {
  if (!todoListId) {
    return;
  }

  const { error } = await supabase
    .from('memory_core_todo_lists')
    .delete()
    .eq('id', todoListId);

  if (error) {
    console.error('Error deleting todo list:', error);
    throw error;
  }
}

export async function getTodoListWithItemsAndTags(todoListId) {
  if (!todoListId) {
    return null;
  }

  const { data, error } = await supabase
    .from('memory_core_todo_lists')
    .select(`
      ${TODO_LIST_COLUMNS},
      memory_item:memory_items(id, name, memory_key),
      tags:memory_core_todo_tags(${TODO_TAG_COLUMNS}),
      items:memory_core_todo_items(
        ${TODO_ITEM_COLUMNS},
        item_tags:memory_core_todo_item_tags(
          todo_tag_id,
          tag:memory_core_todo_tags(${TODO_TAG_COLUMNS})
        )
      )
    `)
    .eq('id', todoListId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching todo list with items and tags:', error);
    throw error;
  }

  return mapTodoListResult(data);
}

export async function getTodoListWithItems(todoListId) {
  return getTodoListWithItemsAndTags(todoListId);
}

export async function createTodoItem(todoListId, itemInput) {
  let itemOrder = itemInput.itemOrder;

  if (itemOrder === undefined || itemOrder === null) {
    const { data: lastItem, error: lastItemError } = await supabase
      .from('memory_core_todo_items')
      .select('item_order')
      .eq('todo_list_id', todoListId)
      .eq('priority', itemInput.priority || 'Normal')
      .order('item_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastItemError) {
      console.error('Error fetching last todo item order:', lastItemError);
      throw lastItemError;
    }

    itemOrder = Number(lastItem?.item_order ?? -1) + 1;
  }

  const payload = {
    todo_list_id: todoListId,
    name: String(itemInput.name || '').trim(),
    due_date: itemInput.dueDate || null,
    priority: itemInput.priority || 'Normal',
    item_order: itemOrder,
    is_completed: Boolean(itemInput.isCompleted),
  };

  const { data, error } = await supabase
    .from('memory_core_todo_items')
    .insert(payload)
    .select(TODO_ITEM_COLUMNS)
    .single();

  if (error) {
    console.error('Error creating todo item:', error);
    throw error;
  }

  const tags = await setTodoItemTags(data.id, itemInput.tagIds ?? []);
  return {
    ...data,
    tags,
    tagIds: tags.map((tag) => tag.id),
  };
}

export async function updateTodoItem(todoItemId, itemInput) {
  const payload = {};

  if (
    Object.prototype.hasOwnProperty.call(itemInput, 'priority') &&
    !Object.prototype.hasOwnProperty.call(itemInput, 'itemOrder')
  ) {
    const { data: currentItem, error: currentItemError } = await supabase
      .from('memory_core_todo_items')
      .select('todo_list_id, priority')
      .eq('id', todoItemId)
      .single();

    if (currentItemError) {
      console.error('Error fetching current todo item before update:', currentItemError);
      throw currentItemError;
    }

    if (currentItem.priority !== itemInput.priority) {
      const { data: lastItem, error: lastItemError } = await supabase
        .from('memory_core_todo_items')
        .select('item_order')
        .eq('todo_list_id', currentItem.todo_list_id)
        .eq('priority', itemInput.priority || 'Normal')
        .neq('id', todoItemId)
        .order('item_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastItemError) {
        console.error('Error fetching target priority order before update:', lastItemError);
        throw lastItemError;
      }

      payload.item_order = Number(lastItem?.item_order ?? -1) + 1;
    }
  }

  if (Object.prototype.hasOwnProperty.call(itemInput, 'name')) {
    payload.name = String(itemInput.name || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(itemInput, 'dueDate')) {
    payload.due_date = itemInput.dueDate || null;
  }

  if (Object.prototype.hasOwnProperty.call(itemInput, 'priority')) {
    payload.priority = itemInput.priority || 'Normal';
  }

  if (Object.prototype.hasOwnProperty.call(itemInput, 'itemOrder')) {
    payload.item_order = Number(itemInput.itemOrder ?? 0);
  }

  if (Object.prototype.hasOwnProperty.call(itemInput, 'isCompleted')) {
    payload.is_completed = Boolean(itemInput.isCompleted);
  }

  const { data, error } = await supabase
    .from('memory_core_todo_items')
    .update(payload)
    .eq('id', todoItemId)
    .select(TODO_ITEM_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating todo item:', error);
    throw error;
  }

  const tags = Object.prototype.hasOwnProperty.call(itemInput, 'tagIds')
    ? await setTodoItemTags(todoItemId, itemInput.tagIds)
    : await getTodoItemTags(todoItemId);

  return {
    ...data,
    tags,
    tagIds: tags.map((tag) => tag.id),
  };
}

export async function reorderTodoItems(todoListId, items) {
  const normalizedItems = (items ?? []).map((item, index) => ({
    id: Number(item.id),
    itemOrder: Number(item.item_order ?? index),
  }));

  const temporaryOffset = 1000000;
  const temporaryUpdates = normalizedItems.map((item, index) =>
    supabase
      .from('memory_core_todo_items')
      .update({ item_order: temporaryOffset + index })
      .eq('id', item.id)
      .eq('todo_list_id', todoListId)
      .select('id')
      .single()
  );

  const temporaryResults = await Promise.all(temporaryUpdates);
  const failedTemporaryUpdate = temporaryResults.find((result) => result.error);

  if (failedTemporaryUpdate?.error) {
    console.error('Error staging todo item reorder:', JSON.stringify(failedTemporaryUpdate.error, null, 2));
    throw failedTemporaryUpdate.error;
  }

  const finalUpdates = normalizedItems.map((item) =>
    supabase
      .from('memory_core_todo_items')
      .update({ item_order: item.itemOrder })
      .eq('id', item.id)
      .eq('todo_list_id', todoListId)
      .select(TODO_ITEM_COLUMNS)
      .single()
  );

  const finalResults = await Promise.all(finalUpdates);
  const failedFinalUpdate = finalResults.find((result) => result.error);

  if (failedFinalUpdate?.error) {
    console.error('Error reordering todo items:', JSON.stringify(failedFinalUpdate.error, null, 2));
    throw failedFinalUpdate.error;
  }

  const refreshedTodoList = await getTodoListWithItemsAndTags(todoListId);
  return refreshedTodoList?.items ?? [];
}

export async function deleteTodoItem(todoItemId) {
  const { error } = await supabase
    .from('memory_core_todo_items')
    .delete()
    .eq('id', todoItemId);

  if (error) {
    console.error('Error deleting todo item:', error);
    throw error;
  }
}
