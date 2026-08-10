import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.amount || !body.reason) {
      return NextResponse.json({ error: 'amount and reason are required' }, { status: 400 });
    }

    if (!body.idempotencyKey) {
      return NextResponse.json({ error: 'idempotencyKey is required for withdrawals' }, { status: 400 });
    }

    const movement = await CashService.createWithdrawal({
      cashSessionId: id,
      userId: body.userId || body.collectorId || 'SYSTEM',
      amount: body.amount,
      reason: body.reason,
      destination: body.destination,
      latitude: body.latitude,
      longitude: body.longitude,
      deviceId: body.deviceId,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process withdrawal' }, { status: 400 });
  }
}
