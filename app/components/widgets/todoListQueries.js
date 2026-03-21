'use client';

import { supabase } from '../supabaseClient';
import { sortTodoItems } from './todoListUtils';

const TODO_LIST_COLUMNS = `
  id,
  created_at,
  updated_at,
  name,
  memory_item_id
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

function mapTodoListResult(data) {
  if (!data) {
    return null;
  }

  return {
    ...data,
    items: sortTodoItems(data.items ?? []),
  };
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

export async function getTodoListWithItems(todoListId) {
  if (!todoListId) {
    return null;
  }

  const { data, error } = await supabase
    .from('memory_core_todo_lists')
    .select(`
      ${TODO_LIST_COLUMNS},
      memory_item:memory_items(id, name, memory_key),
      items:memory_core_todo_items(${TODO_ITEM_COLUMNS})
    `)
    .eq('id', todoListId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching todo list with items:', error);
    throw error;
  }

  return mapTodoListResult(data);
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

  return data;
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

  return data;
}

export async function reorderTodoItems(todoListId, items) {
  const updates = items.map((item) =>
    supabase
      .from('memory_core_todo_items')
      .update({ item_order: Number(item.item_order ?? 0) })
      .eq('id', item.id)
      .eq('todo_list_id', todoListId)
      .select(TODO_ITEM_COLUMNS)
      .single()
  );

  const results = await Promise.all(updates);
  const failedUpdate = results.find((result) => result.error);

  if (failedUpdate?.error) {
    console.error('Error reordering todo items:', failedUpdate.error);
    throw failedUpdate.error;
  }

  return sortTodoItems(results.map((result) => result.data).filter(Boolean));
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
