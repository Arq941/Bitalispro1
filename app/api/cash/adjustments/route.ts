import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.cashSessionId || !body.amount || !body.reason) {
      return NextResponse.json({ error: 'cashSessionId, amount, and reason are required' }, { status: 400 });
    }

    const authorizedBy = body.authorizedBy || body.userId || 'SUPERVISOR';

    const adjustment = await CashService.createAdjustment({
      cashSessionId: body.cashSessionId,
      originalMovementId: body.originalMovementId,
      amount: body.amount,
      reason: body.reason,
      authorizedBy,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, data: adjustment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create cash adjustment' }, { status: 400 });
  }
}
