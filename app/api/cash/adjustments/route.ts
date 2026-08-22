import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import { requireTrustedRole } from '@/src/server/auth/request-context';

export async function POST(req: NextRequest) {
  try {
    const supervisor=requireTrustedRole(req,['ADMIN','SUPERVISORA']);
    const body = await req.json();

    if (!body.cashSessionId || !body.amount || !body.reason) {
      return NextResponse.json({ error: 'cashSessionId, amount, and reason are required' }, { status: 400 });
    }

    const authorizedBy = supervisor.userId;

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
