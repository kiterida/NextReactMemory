import { supabase } from '../components/supabaseClient';

export const TIME_TRACKING_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
export const TIME_TRACKING_AUTO_STOP_GRACE_MS = 60 * 1000;
export const TIME_TRACKING_ACTIVITY_SYNC_MS = 30 * 1000;

const TIME_TRACKING_SESSION_SELECT = `
  id,
  created_at,
  memory_item_id,
  title,
  notes,
  started_at,
  ended_at,
  duration_seconds,
  is_running,
  stop_reason,
  last_activity_at
`;

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  return fallbackMessage;
};

const enrichSessionsWithMemoryItems = async (sessions = []) => {
  const memoryItemIds = [...new Set(
    sessions
      .map((session) => toNullableNumber(session.memory_item_id))
      .filter((value) => value !== null)
  )];

  if (memoryItemIds.length === 0) {
    return sessions.map((session) => ({
      ...session,
      memory_item_name: null,
    }));
  }

  const { data, error } = await supabase
    .from('memory_items')
    .select('id, name')
    .in('id', memoryItemIds);

  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to load linked memory items.'));
  }

  const memoryItemMap = new Map((data ?? []).map((item) => [Number(item.id), item.name ?? null]));

  return sessions.map((session) => ({
    ...session,
    memory_item_name: memoryItemMap.get(Number(session.memory_item_id)) ?? null,
  }));
};

export function getElapsedDurationSeconds(startedAt, endedAt = null) {
  const startedAtMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) {
    return 0;
  }

  const endedAtMs = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!Number.isFinite(endedAtMs)) {
    return 0;
  }

  return Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000));
}

export function getSessionDurationSeconds(session) {
  if (!session) {
    return 0;
  }

  if (Number.isFinite(Number(session.duration_seconds))) {
    return Math.max(0, Number(session.duration_seconds));
  }

  return getElapsedDurationSeconds(session.started_at, session.ended_at);
}

export function formatDuration(durationSeconds) {
  const totalSeconds = Math.max(0, Number(durationSeconds) || 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getDateInputRangeStart(dateValue) {
  if (!dateValue) {
    return null;
  }

  return new Date(`${dateValue}T00:00:00`).toISOString();
}

export function getDateInputRangeEnd(dateValue) {
  if (!dateValue) {
    return null;
  }

  return new Date(`${dateValue}T23:59:59.999`).toISOString();
}

export async function fetchMemoryItemOptions(searchTerm = '') {
  let query = supabase
    .from('memory_items')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(50);

  const trimmedSearch = String(searchTerm ?? '').trim();
  if (trimmedSearch) {
    query = query.ilike('name', `%${trimmedSearch}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to load memory items.'));
  }

  return (data ?? []).map((item) => ({
    id: Number(item.id),
    name: item.name ?? `Memory item ${item.id}`,
  }));
}

export async function fetchTimeTrackingSessionById(sessionId) {
  const normalizedId = toNullableNumber(sessionId);
  if (normalizedId === null) {
    return null;
  }

  const { data, error } = await supabase
    .from('time_tracking_sessions')
    .select(TIME_TRACKING_SESSION_SELECT)
    .eq('id', normalizedId)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to load time tracking session.'));
  }

  if (!data) {
    return null;
  }

  const [enrichedSession] = await enrichSessionsWithMemoryItems([data]);
  return enrichedSession ?? null;
}

export async function updateTimeTrackingSession(sessionId, updates) {
  const normalizedId = toNullableNumber(sessionId);
  if (normalizedId === null) {
    throw new Error('Time tracking session id is required.');
  }

  const updatePayload = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'memory_item_id')) {
    updatePayload.memory_item_id = toNullableNumber(updates.memory_item_id);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
    updatePayload.title = updates.title ? String(updates.title).trim() : null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    updatePayload.notes = updates.notes ? String(updates.notes).trim() : null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'last_activity_at')) {
    updatePayload.last_activity_at = updates.last_activity_at ?? null;
  }

  const { data, error } = await supabase
    .from('time_tracking_sessions')
    .update(updatePayload)
    .eq('id', normalizedId)
    .select(TIME_TRACKING_SESSION_SELECT)
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to update time tracking session.'));
  }

  const [enrichedSession] = await enrichSessionsWithMemoryItems([data]);
  return enrichedSession;
}

export async function stopTimeTrackingSession(sessionId, options = {}) {
  const session = options.session ?? await fetchTimeTrackingSessionById(sessionId);
  if (!session) {
    return null;
  }

  const endedAt = options.endedAt ?? new Date().toISOString();
  const durationSeconds = getElapsedDurationSeconds(session.started_at, endedAt);

  const { data, error } = await supabase
    .from('time_tracking_sessions')
    .update({
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      is_running: false,
      stop_reason: options.stopReason ?? 'manual',
      last_activity_at: options.lastActivityAt ?? endedAt,
    })
    .eq('id', Number(session.id))
    .eq('is_running', true)
    .select(TIME_TRACKING_SESSION_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to stop time tracking session.'));
  }

  if (!data) {
    return session;
  }

  const [enrichedSession] = await enrichSessionsWithMemoryItems([data]);
  return enrichedSession;
}

export async function startTimeTrackingSession(payload = {}) {
  const nowIso = payload.startedAt ?? new Date().toISOString();

  const { data: runningSessions, error: runningSessionsError } = await supabase
    .from('time_tracking_sessions')
    .select(TIME_TRACKING_SESSION_SELECT)
    .eq('is_running', true)
    .order('started_at', { ascending: false });

  if (runningSessionsError) {
    throw new Error(formatSupabaseError(runningSessionsError, 'Failed to verify active sessions.'));
  }

  for (const runningSession of runningSessions ?? []) {
    await stopTimeTrackingSession(runningSession.id, {
      session: runningSession,
      endedAt: nowIso,
      stopReason: 'manual',
      lastActivityAt: payload.lastActivityAt ?? nowIso,
    });
  }

  const insertPayload = {
    memory_item_id: toNullableNumber(payload.memoryItemId),
    title: payload.title ? String(payload.title).trim() : null,
    notes: payload.notes ? String(payload.notes).trim() : null,
    started_at: nowIso,
    is_running: true,
    last_activity_at: payload.lastActivityAt ?? nowIso,
  };

  const { data, error } = await supabase
    .from('time_tracking_sessions')
    .insert(insertPayload)
    .select(TIME_TRACKING_SESSION_SELECT)
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to start time tracking session.'));
  }

  const [enrichedSession] = await enrichSessionsWithMemoryItems([data]);
  return enrichedSession;
}

export async function fetchTimeTrackingSessions(filters = {}) {
  let query = supabase
    .from('time_tracking_sessions')
    .select(TIME_TRACKING_SESSION_SELECT)
    .order('started_at', { ascending: false });

  const memoryItemId = toNullableNumber(filters.memoryItemId);
  if (memoryItemId !== null) {
    query = query.eq('memory_item_id', memoryItemId);
  }

  if (filters.status === 'active') {
    query = query.eq('is_running', true);
  } else if (filters.status === 'completed') {
    query = query.eq('is_running', false);
  }

  const startDate = getDateInputRangeStart(filters.startDate);
  if (startDate) {
    query = query.gte('started_at', startDate);
  }

  const endDate = getDateInputRangeEnd(filters.endDate);
  if (endDate) {
    query = query.lte('started_at', endDate);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to load time tracking sessions.'));
  }

  return enrichSessionsWithMemoryItems(data ?? []);
}

export function getDateBucketTotals(sessions = [], now = new Date()) {
  const nowDate = new Date(now);
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const startOfWeek = new Date(startOfToday);
  const currentDay = startOfToday.getDay();
  const distanceFromMonday = (currentDay + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - distanceFromMonday);
  const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);

  return sessions.reduce(
    (totals, session) => {
      const startedAt = new Date(session.started_at);
      const durationSeconds = getSessionDurationSeconds(session);

      if (startedAt >= startOfToday) {
        totals.today += durationSeconds;
      }

      if (startedAt >= startOfWeek) {
        totals.thisWeek += durationSeconds;
      }

      if (startedAt >= startOfMonth) {
        totals.thisMonth += durationSeconds;
      }

      return totals;
    },
    { today: 0, thisWeek: 0, thisMonth: 0 }
  );
}
