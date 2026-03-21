import { supabase } from '../supabaseClient';

const DASHBOARD_COLUMNS = `
  id,
  created_at,
  updated_at,
  user_id,
  name,
  description,
  icon,
  color,
  display_order,
  is_default
`;

function getDashboardPayload(input) {
  const payload = {
    name: String(input.name || '').trim(),
    description: String(input.description || '').trim() || null,
    icon: input.icon || null,
    color: input.color || null,
  };

  if (typeof input.displayOrder === 'number') {
    payload.display_order = input.displayOrder;
  }

  if (typeof input.isDefault === 'boolean') {
    payload.is_default = input.isDefault;
  }

  return payload;
}

export async function getDashboards(userId) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('memory_core_dashboards')
    .select(DASHBOARD_COLUMNS)
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching dashboards:', error);
    throw error;
  }

  return data ?? [];
}

export async function getDashboardById(dashboardId, userId) {
  if (!dashboardId || !userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('memory_core_dashboards')
    .select(DASHBOARD_COLUMNS)
    .eq('id', dashboardId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching dashboard by id:', error);
    throw error;
  }

  return data ?? null;
}

export async function createDashboard(input) {
  if (!input?.userId) {
    throw new Error('A userId is required to create a dashboard.');
  }

  const { count, error: countError } = await supabase
    .from('memory_core_dashboards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId);

  if (countError) {
    console.error('Error counting dashboards:', countError);
    throw countError;
  }

  const payload = {
    user_id: input.userId,
    ...getDashboardPayload({
      ...input,
      displayOrder: input.displayOrder ?? count ?? 0,
    }),
  };

  const { data, error } = await supabase
    .from('memory_core_dashboards')
    .insert(payload)
    .select(DASHBOARD_COLUMNS)
    .single();

  if (error) {
    console.error('Error creating dashboard:', error);
    throw error;
  }

  return data;
}

export async function updateDashboard(dashboardId, input, userId) {
  const payload = getDashboardPayload(input);

  const { data, error } = await supabase
    .from('memory_core_dashboards')
    .update(payload)
    .eq('id', dashboardId)
    .eq('user_id', userId)
    .select(DASHBOARD_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating dashboard:', error);
    throw error;
  }

  return data;
}

export async function getWidgetsForDashboard({ userId, dashboardId }) {
  let query = supabase
    .from('memory_core_widgets')
    .select(`
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
    `)
    .eq('dashboard_id', dashboardId)
    .eq('is_visible', true)
    .order('display_order', { ascending: true })
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
