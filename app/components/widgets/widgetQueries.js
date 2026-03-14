import { supabase } from '../supabaseClient';

const WIDGET_COLUMNS = `
  id,
  created_at,
  updated_at,
  user_id,
  dashboard_id,
  widget_type,
  title,
  position_x,
  position_y,
  width,
  height,
  sort_order,
  is_visible,
  config
`;

export async function fetchDashboardWidgets({ userId, dashboardId }) {
  let query = supabase
    .from('memory_core_widgets')
    .select(WIDGET_COLUMNS)
    .eq('dashboard_id', dashboardId)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching dashboard widgets:', error);
    throw error;
  }

  return data ?? [];
}

export async function createDashboardWidget(widgetInput) {
  const payload = {
    dashboard_id: widgetInput.dashboardId,
    user_id: widgetInput.userId,
    widget_type: widgetInput.widgetType,
    title: widgetInput.title,
    position_x: widgetInput.positionX ?? 0,
    position_y: widgetInput.positionY ?? 0,
    width: widgetInput.width ?? 6,
    height: widgetInput.height ?? 1,
    sort_order: widgetInput.sortOrder ?? 0,
    is_visible: widgetInput.isVisible ?? true,
    config: widgetInput.config ?? {},
  };

  const { data, error } = await supabase
    .from('memory_core_widgets')
    .insert(payload)
    .select(WIDGET_COLUMNS)
    .single();

  if (error) {
    console.error('Error creating dashboard widget:', error);
    throw error;
  }

  return data;
}

export async function updateDashboardWidget(widgetId, widgetInput) {
  const payload = {
    title: widgetInput.title,
    width: widgetInput.width,
    height: widgetInput.height,
    config: widgetInput.config ?? {},
  };

  const { data, error } = await supabase
    .from('memory_core_widgets')
    .update(payload)
    .eq('id', widgetId)
    .select(WIDGET_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating dashboard widget:', error);
    throw error;
  }

  return data;
}

export async function deleteDashboardWidget(widgetId) {
  const { error } = await supabase
    .from('memory_core_widgets')
    .delete()
    .eq('id', widgetId);

  if (error) {
    console.error('Error deleting dashboard widget:', error);
    throw error;
  }
}

export async function fetchMemoryItemOptions(searchTerm = '') {
  let query = supabase
    .from('memory_items')
    .select('id, name, memory_key')
    .order('name', { ascending: true })
    .limit(25);

  const trimmedSearch = String(searchTerm).trim();
  if (trimmedSearch.length >= 2) {
    query = query.ilike('name', `%${trimmedSearch}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching memory item options:', error);
    throw error;
  }

  return data ?? [];
}

export async function fetchMemoryItemById(memoryItemId) {
  if (!memoryItemId) {
    return null;
  }

  const { data, error } = await supabase
    .from('memory_items')
    .select('id, name, memory_key, header_image, description, rich_text')
    .eq('id', memoryItemId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching memory item by id:', error);
    throw error;
  }

  return data ?? null;
}
