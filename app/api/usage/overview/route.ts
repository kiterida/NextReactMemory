import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUsageOverview } from '@/app/lib/usageOverview';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdentifier = session?.user?.email || session?.user?.name;

  if (!userIdentifier) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const usage = await getUsageOverview();
    return NextResponse.json(usage, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Usage overview failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to load usage overview.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
