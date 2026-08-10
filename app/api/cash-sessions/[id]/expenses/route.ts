import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.amount || !body.description) {
      return NextResponse.json({ error: 'amount and description are required' }, { status: 400 });
    }

    if (!body.userId && !body.collectorId) {
      return NextResponse.json({ error: 'userId or collectorId is required' }, { status: 400 });
    }

    const expense = await CashService.createExpense({
      cashSessionId: id,
      userId: body.userId || body.collectorId,
      collectorId: body.collectorId || body.userId,
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
    return NextResponse.json({ error: error.message || 'Failed to create expense' }, { status: 400 });
  }
}
