import { supabase } from '../components/supabaseClient';

export const TIME_TRACKING_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
export const TIME_TRACKING_AUTO_STOP_GRACE_MS = 60 * 1000;
export const TIME_TRACKING_ACTIVITY_SYNC_MS = 30 * 1000;
export const DEFAULT_TIME_TRACKING_ALERT_THRESHOLD_MINUTES = 25;

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
  last_activity_at,
  alert_threshold_minutes,
  alert_triggered,
  alert_triggered_at
`;

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNullableInteger = (value) => {
  const normalized = toNullableNumber(value);
  if (normalized === null) {
    return null;
  }

  const rounded = Math.round(normalized);
  return Number.isFinite(rounded) ? rounded : null;
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

  // Running sessions must always derive elapsed time from timestamps.
  if (session.is_running) {
    return getElapsedDurationSeconds(session.started_at, null);
  }

  if (Number.isFinite(Number(session.duration_seconds))) {
    return Math.max(0, Number(session.duration_seconds));
  }

  return getElapsedDurationSeconds(session.started_at, session.ended_at);
}

export function formatDuration(durationSeconds) {
  const totalSeconds = Math.max(0, Number(durationSeconds) || 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (totalHours > 0) {
    return `${totalHours}h ${minutes}m`;
  }

  return `${totalMinutes}m`;
}

export function formatThresholdMinutes(value) {
  const minutes = toNullableInteger(value);
  if (minutes === null) {
    return '-';
  }

  return `${minutes} min`;
}

export function getAlertThresholdSeconds(session) {
  const minutes = toNullableInteger(session?.alert_threshold_minutes);
  if (minutes === null || minutes <= 0) {
    return null;
  }

  return minutes * 60;
}

export function isSessionOverThreshold(session, elapsedSeconds = null) {
  const thresholdSeconds = getAlertThresholdSeconds(session);
  if (thresholdSeconds === null) {
    return false;
  }

  const duration = elapsedSeconds ?? getSessionDurationSeconds(session);
  return duration >= thresholdSeconds;
}

export function getOverdueSeconds(session, elapsedSeconds = null) {
  const thresholdSeconds = getAlertThresholdSeconds(session);
  if (thresholdSeconds === null) {
    return 0;
  }

  const duration = elapsedSeconds ?? getSessionDurationSeconds(session);
  return Math.max(0, duration - thresholdSeconds);
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

  const existingSession = await fetchTimeTrackingSessionById(normalizedId);
  if (!existingSession) {
    throw new Error('Time tracking session not found.');
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

  if (Object.prototype.hasOwnProperty.call(updates, 'started_at')) {
    updatePayload.started_at = updates.started_at ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'ended_at')) {
    updatePayload.ended_at = updates.ended_at ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'duration_seconds')) {
    updatePayload.duration_seconds = toNullableInteger(updates.duration_seconds);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'is_running')) {
    updatePayload.is_running = Boolean(updates.is_running);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'stop_reason')) {
    updatePayload.stop_reason = updates.stop_reason ? String(updates.stop_reason).trim() : null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'last_activity_at')) {
    updatePayload.last_activity_at = updates.last_activity_at ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'alert_threshold_minutes')) {
    updatePayload.alert_threshold_minutes = toNullableInteger(updates.alert_threshold_minutes);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'alert_triggered')) {
    updatePayload.alert_triggered = Boolean(updates.alert_triggered);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'alert_triggered_at')) {
    updatePayload.alert_triggered_at = updates.alert_triggered_at ?? null;
  }

  const nextStartedAt = Object.prototype.hasOwnProperty.call(updatePayload, 'started_at')
    ? updatePayload.started_at
    : existingSession.started_at;
  const nextIsRunning = Object.prototype.hasOwnProperty.call(updatePayload, 'is_running')
    ? updatePayload.is_running
    : Boolean(existingSession.is_running);
  const nextEndedAt = nextIsRunning
    ? null
    : Object.prototype.hasOwnProperty.call(updatePayload, 'ended_at')
      ? updatePayload.ended_at
      : existingSession.ended_at;

  if (nextIsRunning) {
    updatePayload.ended_at = null;
    updatePayload.duration_seconds = null;
    updatePayload.stop_reason = null;
  } else {
    updatePayload.ended_at = nextEndedAt;

    if (nextStartedAt && nextEndedAt) {
      updatePayload.duration_seconds = getElapsedDurationSeconds(nextStartedAt, nextEndedAt);
    } else if (!Object.prototype.hasOwnProperty.call(updatePayload, 'duration_seconds')) {
      updatePayload.duration_seconds = null;
    }
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

export async function createTimeTrackingSession(payload = {}) {
  const startedAt = payload.startedAt ?? new Date().toISOString();
  const endedAt = payload.endedAt ?? startedAt;
  const durationSeconds = getElapsedDurationSeconds(startedAt, endedAt);

  const insertPayload = {
    memory_item_id: toNullableNumber(payload.memoryItemId),
    title: payload.title ? String(payload.title).trim() : null,
    notes: payload.notes ? String(payload.notes).trim() : null,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    is_running: false,
    stop_reason: payload.stopReason ? String(payload.stopReason).trim() : 'manual-entry',
    last_activity_at: endedAt,
    alert_threshold_minutes: toNullableInteger(payload.alertThresholdMinutes),
    alert_triggered: false,
    alert_triggered_at: null,
  };

  const { data, error } = await supabase
    .from('time_tracking_sessions')
    .insert(insertPayload)
    .select(TIME_TRACKING_SESSION_SELECT)
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to create time tracking session.'));
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
    alert_threshold_minutes: toNullableInteger(payload.alertThresholdMinutes),
    alert_triggered: false,
    alert_triggered_at: null,
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

export async function deleteTimeTrackingSession(sessionId) {
  const normalizedId = toNullableNumber(sessionId);
  if (normalizedId === null) {
    throw new Error('Time tracking session id is required.');
  }

  const session = await fetchTimeTrackingSessionById(normalizedId);
  if (!session) {
    return null;
  }

  if (session.is_running) {
    throw new Error('Stop the running session before deleting it.');
  }

  const { error } = await supabase
    .from('time_tracking_sessions')
    .delete()
    .eq('id', normalizedId);

  if (error) {
    throw new Error(formatSupabaseError(error, 'Failed to delete time tracking session.'));
  }

  return session;
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

      totals.allTime += durationSeconds;

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
    { today: 0, thisWeek: 0, thisMonth: 0, allTime: 0 }
  );
}






