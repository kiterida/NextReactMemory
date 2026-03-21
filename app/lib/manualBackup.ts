import type { SupabaseClient } from '@supabase/supabase-js';

export const BACKUP_TABLES = [
  {
    tableName: 'memory_items',
    fileName: 'memory_items.csv',
    orderColumn: 'id',
  },
  {
    tableName: 'memory_core_todo_items',
    fileName: 'memory_core_todo_items.csv',
    orderColumn: 'id',
  },
  {
    tableName: 'memory_core_todo_lists',
    fileName: 'memory_core_todo_lists.csv',
    orderColumn: 'id',
  },
  {
    tableName: 'memory_core_dashboards',
    fileName: 'memory_core_dashboards.csv',
    orderColumn: 'id',
  },
  {
    tableName: 'memory_core_widgets',
    fileName: 'memory_core_widgets.csv',
    orderColumn: 'id',
  },
] as const;

const BACKUP_PAGE_SIZE = 1000;

type BackupRow = Record<string, unknown>;

function formatBackupTimestampPart(value: number) {
  return String(value).padStart(2, '0');
}

export function createBackupFolderPath(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = formatBackupTimestampPart(date.getUTCMonth() + 1);
  const day = formatBackupTimestampPart(date.getUTCDate());
  const hours = formatBackupTimestampPart(date.getUTCHours());
  const minutes = formatBackupTimestampPart(date.getUTCMinutes());
  const seconds = formatBackupTimestampPart(date.getUTCSeconds());

  return `backups/${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue =
    typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function convertRowsToCsv(rows: BackupRow[]) {
  if (rows.length === 0) {
    return '';
  }

  const headers: string[] = [];
  const seenHeaders = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seenHeaders.has(key)) {
        seenHeaders.add(key);
        headers.push(key);
      }
    }
  }

  const csvLines = [
    headers.map((header) => escapeCsvCell(header)).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(',')),
  ];

  return `\uFEFF${csvLines.join('\r\n')}`;
}

export async function fetchAllTableRows(
  supabase: SupabaseClient,
  tableName: string,
  orderColumn = 'id',
) {
  const rows: BackupRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderColumn, { ascending: true })
      .range(from, from + BACKUP_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to export ${tableName}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (data.length < BACKUP_PAGE_SIZE) {
      break;
    }

    from += BACKUP_PAGE_SIZE;
  }

  return rows;
}
