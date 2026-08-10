import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const reviewerId = body.reviewerId || body.userId || 'SUPERVISOR';
    const reason = body.reason;

    const result = await CashService.rejectCashVariance(id, reviewerId, reason);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reject cash variance' }, { status: 400 });
  }
}
