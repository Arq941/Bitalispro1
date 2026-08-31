import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import {httpStatusForCashError,requireCashSessionAccess} from '@/src/cash/cash-route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {context}=await requireCashSessionAccess(req,id);
    const body = await req.json();

    if (!body.amount || !body.reason) {
      return NextResponse.json({ error: 'amount and reason are required' }, { status: 400 });
    }

    if (!body.idempotencyKey) {
      return NextResponse.json({ error: 'idempotencyKey is required for withdrawals' }, { status: 400 });
    }

    const movement = await CashService.createWithdrawal({
      cashSessionId: id,
      userId: context.userId,
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
    const message=error.message||'No pudimos registrar el retiro.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}
