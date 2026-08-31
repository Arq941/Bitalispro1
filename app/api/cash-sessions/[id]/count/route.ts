import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import {httpStatusForCashError,requireCashSessionAccess} from '@/src/cash/cash-route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {context}=await requireCashSessionAccess(req,id);
    const body = await req.json();
    const denominations = body.denominations || body;

    const result = await CashService.createCashCount({
      cashSessionId: id,
      countedBy:context.userId,
      denominations,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const message=error.message||'No pudimos registrar el conteo de caja.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}
