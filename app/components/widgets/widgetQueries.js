import { supabase } from '../supabaseClient';
import { getWidgetsForDashboard } from '../dashboards/dashboardQueries';
import { deleteTodoList } from './todoListQueries';

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
  display_order,
  is_visible,
  is_collapsed,
  config
`;

export { getWidgetsForDashboard };

export async function fetchDashboardWidgets({ userId, dashboardId }) {
  return getWidgetsForDashboard({ userId, dashboardId });
}

export async function getDashboardWidgetById(widgetId) {
  if (!widgetId) {
    return null;
  }

  const { data, error } = await supabase
    .from('memory_core_widgets')
    .select(WIDGET_COLUMNS)
    .eq('id', widgetId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching dashboard widget by id:', error);
    throw error;
  }

  return data ?? null;
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
    display_order: widgetInput.displayOrder ?? widgetInput.sortOrder ?? 0,
    is_visible: widgetInput.isVisible ?? true,
    is_collapsed: widgetInput.isCollapsed ?? false,
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
  const widget = await getDashboardWidgetById(widgetId);

  if (!widget) {
    return;
  }

  const todoListId = Number(widget?.config?.todo_list_id ?? 0);
  const isTodoListWidget = widget.widget_type === 'todo_list' && Number.isFinite(todoListId) && todoListId > 0;

  if (isTodoListWidget) {
    await deleteTodoList(todoListId);
  }

  const { error } = await supabase
    .from('memory_core_widgets')
    .delete()
    .eq('id', widgetId);

  if (error) {
    console.error('Error deleting dashboard widget:', error);
    throw error;
  }
}

export async function updateDashboardWidgetOrder(widgets) {
  const results = await Promise.all(
    widgets.map((widget, index) =>
      supabase
        .from('memory_core_widgets')
        .update({ display_order: index })
        .eq('id', widget.id)
    )
  );

  const failedResult = results.find((result) => result.error);

  if (failedResult?.error) {
    console.error('Error updating dashboard widget order:', failedResult.error);
    throw failedResult.error;
  }

  return widgets.map((widget, index) => ({
    ...widget,
    display_order: index,
  }));
}

export async function updateDashboardWidgetCollapsed(widgetId, isCollapsed) {
  const { data, error } = await supabase
    .from('memory_core_widgets')
    .update({ is_collapsed: isCollapsed })
    .eq('id', widgetId)
    .select(WIDGET_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating dashboard widget collapse state:', error);
    throw error;
  }

  return data;
}

export async function fetchMemoryItemOptions(searchTerm = '') {
  let query = supabase
    .from('memory_items')
    .select('id, name, memory_key, row_order')
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
    .select('id, name, memory_key, row_order, header_image, description, rich_text')
    .eq('id', memoryItemId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching memory item by id:', error);
    throw error;
  }

  return data ?? null;
}
