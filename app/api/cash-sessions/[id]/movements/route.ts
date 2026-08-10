import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.amount || !body.type) {
      return NextResponse.json({ error: 'amount and type are required' }, { status: 400 });
    }

    const movement = await CashService.addCashMovement({
      cashSessionId: id,
      collectorId: body.collectorId,
      type: body.type,
      amount: body.amount,
      reference: body.reference,
      description: body.description,
      clientId: body.clientId,
      paymentId: body.paymentId,
      clientCapturedAt: body.clientCapturedAt,
      idempotencyKey: body.idempotencyKey,
      createdBy: body.userId || body.createdBy,
    });

    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add cash movement' }, { status: 400 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await CashService.getSessionById(id);

    if (!session) {
      return NextResponse.json({ error: 'Cash session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: session.movements }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch cash movements' }, { status: 400 });
  }
}
