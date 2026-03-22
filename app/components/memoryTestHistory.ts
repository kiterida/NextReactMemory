'use client';

import { supabase } from './supabaseClient';

const SESSION_COLUMNS = `
  id,
  memory_list_id,
  started_at,
  completed_at,
  total_items,
  correct_count,
  incorrect_count,
  created_at
`;

const RESULT_COLUMNS = `
  id,
  session_id,
  memory_item_id,
  was_correct,
  answered_at,
  created_at
`;

export type MemoryTestSession = {
  id: number;
  memory_list_id: number;
  started_at: string;
  completed_at: string | null;
  total_items: number;
  correct_count: number;
  incorrect_count: number;
  created_at: string;
};

export type MemoryTestResult = {
  id: number;
  session_id: number;
  memory_item_id: number;
  was_correct: boolean;
  answered_at: string;
  created_at: string;
};

export type AccuracySummary = {
  totalAnswers: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number | null;
};

export type MemoryTestSessionHistory = MemoryTestSession & {
  results: Array<MemoryTestResult & {
    memory_item: {
      id: number;
      name: string | null;
      memory_key: string | number | null;
    } | null;
  }>;
};

type RawMemoryTestSessionHistoryRow = MemoryTestSession & {
  results?: Array<MemoryTestResult & {
    memory_item:
      | {
          id: number;
          name: string | null;
          memory_key: string | number | null;
        }
      | Array<{
          id: number;
          name: string | null;
          memory_key: string | number | null;
        }>
      | null;
  }> | null;
};

function buildAccuracySummary(rows: Array<{ was_correct: boolean }> | null | undefined): AccuracySummary {
  const totalAnswers = rows?.length ?? 0;
  const correctCount = (rows ?? []).reduce((count, row) => count + (row.was_correct ? 1 : 0), 0);
  const incorrectCount = totalAnswers - correctCount;

  return {
    totalAnswers,
    correctCount,
    incorrectCount,
    accuracy: totalAnswers > 0 ? correctCount / totalAnswers : null,
  };
}

export async function createMemoryTestSession({
  memoryListId,
  totalItems,
  startedAt = new Date().toISOString(),
}: {
  memoryListId: number;
  totalItems: number;
  startedAt?: string;
}) {
  const { data, error } = await supabase
    .from('memory_test_sessions')
    .insert({
      memory_list_id: memoryListId,
      total_items: totalItems,
      started_at: startedAt,
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    console.error('Error creating memory test session:', error);
    throw error;
  }

  return data as MemoryTestSession;
}

export async function recordMemoryTestResult({
  sessionId,
  memoryItemId,
  wasCorrect,
  answeredAt = new Date().toISOString(),
}: {
  sessionId: number;
  memoryItemId: number;
  wasCorrect: boolean;
  answeredAt?: string;
}) {
  const { data, error } = await supabase
    .from('memory_test_results')
    .insert({
      session_id: sessionId,
      memory_item_id: memoryItemId,
      was_correct: wasCorrect,
      answered_at: answeredAt,
    })
    .select(RESULT_COLUMNS)
    .single();

  if (error) {
    console.error('Error recording memory test result:', error);
    throw error;
  }

  return data as MemoryTestResult;
}

export async function completeMemoryTestSession({
  sessionId,
  correctCount,
  incorrectCount,
  totalItems,
  completedAt = new Date().toISOString(),
}: {
  sessionId: number;
  correctCount: number;
  incorrectCount: number;
  totalItems: number;
  completedAt?: string;
}) {
  const { data, error } = await supabase
    .from('memory_test_sessions')
    .update({
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      total_items: totalItems,
      completed_at: completedAt,
    })
    .eq('id', sessionId)
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    console.error('Error completing memory test session:', error);
    throw error;
  }

  return data as MemoryTestSession;
}

export async function updateMemoryTestSessionProgress({
  sessionId,
  correctCount,
  incorrectCount,
  totalItems,
}: {
  sessionId: number;
  correctCount: number;
  incorrectCount: number;
  totalItems: number;
}) {
  const { data, error } = await supabase
    .from('memory_test_sessions')
    .update({
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      total_items: totalItems,
    })
    .eq('id', sessionId)
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    console.error('Error updating memory test session progress:', error);
    throw error;
  }

  return data as MemoryTestSession;
}

export async function getLastRevisedDate(listId: number) {
  if (!listId) {
    return null;
  }

  const { data, error } = await supabase
    .from('memory_test_sessions')
    .select('completed_at,started_at')
    .eq('memory_list_id', listId)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching last revised date:', error);
    throw error;
  }

  return data?.completed_at ?? data?.started_at ?? null;
}

export async function getListAccuracy(listId: number) {
  if (!listId) {
    return buildAccuracySummary([]);
  }

  const { data, error } = await supabase
    .from('memory_test_results')
    .select(`
      was_correct,
      session:memory_test_sessions!inner(
        memory_list_id
      )
    `)
    .eq('session.memory_list_id', listId);

  if (error) {
    console.error('Error fetching memory test results for list accuracy:', error);
    throw error;
  }

  return buildAccuracySummary((data ?? []).map((row: any) => ({ was_correct: row.was_correct })));
}

export async function getMemoryItemAccuracy(memoryItemId: number) {
  if (!memoryItemId) {
    return buildAccuracySummary([]);
  }

  const { data, error } = await supabase
    .from('memory_test_results')
    .select('was_correct')
    .eq('memory_item_id', memoryItemId);

  if (error) {
    console.error('Error fetching memory item accuracy:', error);
    throw error;
  }

  return buildAccuracySummary(data);
}

export async function getListRevisionHistory(listId: number, { limit = 10 }: { limit?: number } = {}) {
  if (!listId) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

  const { data, error } = await supabase
    .from('memory_test_sessions')
    .select(`
      ${SESSION_COLUMNS},
      results:memory_test_results(
        ${RESULT_COLUMNS},
        memory_item:memory_items(
          id,
          name,
          memory_key
        )
      )
    `)
    .eq('memory_list_id', listId)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('started_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error('Error fetching list revision history:', error);
    throw error;
  }

  return ((data ?? []) as RawMemoryTestSessionHistoryRow[]).map((session) => ({
    ...session,
    results: (session.results ?? []).map((result) => ({
      ...result,
      memory_item: Array.isArray(result.memory_item)
        ? result.memory_item[0] ?? null
        : result.memory_item ?? null,
    })),
  }));
}
