import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import { requireTrustedRole } from '@/src/server/auth/request-context';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supervisor = requireTrustedRole(req,['ADMIN','SUPERVISORA']);
    const { id } = await params;
    const body = await req.json();

    if (!body.paymentId || !body.refundAmount || !body.reason) {
      return NextResponse.json({ error: 'paymentId, refundAmount, and reason are required' }, { status: 400 });
    }

    const movement = await CashService.createRefund({
      cashSessionId: id,
      userId: supervisor.userId,
      paymentId: body.paymentId,
      refundAmount: body.refundAmount,
      reason: body.reason,
      authorizedBy: supervisor.userId,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error: any) {
    const status=String(error?.message||'').startsWith('UNAUTHORIZED')?401:String(error?.message||'').startsWith('FORBIDDEN')?403:400;
    return NextResponse.json({ error: error.message || 'Failed to process refund' }, { status });
  }
}
