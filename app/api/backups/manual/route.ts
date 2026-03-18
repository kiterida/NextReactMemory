import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { BACKUP_TABLES, convertRowsToCsv, createBackupFolderPath, fetchAllTableRows } from '@/app/lib/manualBackup';
import { getSupabaseAdminClient } from '@/app/lib/supabaseAdmin';

export const runtime = 'nodejs';

const backupBucket = process.env.SUPABASE_BACKUPS_BUCKET || 'backups';

export async function POST() {
  const session = await auth();
  const userIdentifier = session?.user?.email || session?.user?.name;

  if (!userIdentifier) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const folderPath = createBackupFolderPath();
  const uploadedPaths: string[] = [];

  try {
    for (const table of BACKUP_TABLES) {
      const rows = await fetchAllTableRows(supabase, table.tableName, table.orderColumn);
      const csv = convertRowsToCsv(rows);
      const storagePath = `${folderPath}/${table.fileName}`;

      const { error } = await supabase.storage
        .from(backupBucket)
        .upload(storagePath, csv, {
          contentType: 'text/csv',
          upsert: false,
        });

      if (error) {
        throw new Error(`Failed to upload ${table.fileName}: ${error.message}`);
      }

      uploadedPaths.push(storagePath);
    }

    return NextResponse.json({
      bucket: backupBucket,
      folderPath,
      files: uploadedPaths,
      message: 'Backup completed successfully.',
    });
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(backupBucket).remove(uploadedPaths);
    }

    const message = error instanceof Error ? error.message : 'Backup failed.';
    console.error('Manual backup failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


