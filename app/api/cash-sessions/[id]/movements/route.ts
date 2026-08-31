import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import {httpStatusForCashError,requireCashSessionAccess} from '@/src/cash/cash-route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {context,session}=await requireCashSessionAccess(req,id);
    const body = await req.json();

    if (!body.amount || !body.type) {
      return NextResponse.json({ error: 'amount and type are required' }, { status: 400 });
    }

    const movement = await CashService.addCashMovement({
      cashSessionId: id,
      collectorId: session.collectorId,
      type: body.type,
      amount: body.amount,
      reference: body.reference,
      description: body.description,
      clientId: body.clientId,
      paymentId: body.paymentId,
      clientCapturedAt: body.clientCapturedAt,
      idempotencyKey: body.idempotencyKey,
      createdBy: context.userId,
    });

    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error: any) {
    const message=error.message||'No pudimos registrar el movimiento de caja.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {session}=await requireCashSessionAccess(req,id);

    return NextResponse.json({ success: true, data: session.movements }, { status: 200 });
  } catch (error: any) {
    const message=error.message||'No pudimos consultar los movimientos de caja.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}
