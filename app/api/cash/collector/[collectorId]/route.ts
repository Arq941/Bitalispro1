import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ collectorId: string }> }) {
  try {
    const { collectorId } = await params;
    const session = await CashService.getCurrentSession(collectorId);

    if (!session) {
      return NextResponse.json({ success: true, data: null, message: 'No active cash session found for this collector' }, { status: 200 });
    }

    const reconciliation = await CashService.getReconciliation(session.id);

    return NextResponse.json({ success: true, data: reconciliation }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch collector cash session' }, { status: 400 });
  }
}
