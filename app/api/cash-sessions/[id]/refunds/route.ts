import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.paymentId || !body.refundAmount || !body.reason) {
      return NextResponse.json({ error: 'paymentId, refundAmount, and reason are required' }, { status: 400 });
    }

    const movement = await CashService.createRefund({
      cashSessionId: id,
      userId: body.userId || body.collectorId || 'SYSTEM',
      paymentId: body.paymentId,
      refundAmount: body.refundAmount,
      reason: body.reason,
      authorizedBy: body.authorizedBy,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process refund' }, { status: 400 });
  }
}
