import { getSupabaseAdminClient } from './supabaseAdmin';

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

export async function getDashboardsForUser(userId) {
  if (!userId) {
    return [];
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('memory_core_dashboards')
      .select(DASHBOARD_COLUMNS)
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  } catch (error) {
    console.error('Unable to load dashboard navigation:', error);
    return [];
  }
}

export async function getPreferredDashboardForUser(userId) {
  const dashboards = await getDashboardsForUser(userId);
  return dashboards[0] ?? null;
}
