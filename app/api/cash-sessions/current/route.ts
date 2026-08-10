import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || searchParams.get('collectorId');

    if (!userId) {
      return NextResponse.json({ error: 'userId or collectorId query parameter is required' }, { status: 400 });
    }

    const session = await CashService.getCurrentSession(userId);

    if (!session) {
      return NextResponse.json({ success: true, data: null, message: 'No active cash session found' }, { status: 200 });
    }

    return NextResponse.json({ success: true, data: session }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch current cash session' }, { status: 400 });
  }
}
