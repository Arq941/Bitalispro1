import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import {httpStatusForCashError,requireCashSessionAccess} from '@/src/cash/cash-route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {context,session}=await requireCashSessionAccess(req,id);
    const body = await req.json();

    if (!body.amount || !body.description) {
      return NextResponse.json({ error: 'amount and description are required' }, { status: 400 });
    }

    const expense = await CashService.createExpense({
      cashSessionId: id,
      userId: context.userId,
      collectorId: session.collectorId||session.userId,
      amount: body.amount,
      expenseType: body.expenseType || body.type,
      category: body.category,
      description: body.description,
      expenseDate: body.expenseDate,
      receiptMediaId: body.receiptMediaId,
      gpsLatitude: body.latitude ?? body.gpsLatitude,
      gpsLongitude: body.longitude ?? body.gpsLongitude,
      clientCapturedAt: body.clientCapturedAt,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error: any) {
    const message=error.message||'No pudimos registrar el gasto.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}
