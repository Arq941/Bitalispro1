import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import {httpStatusForCashError,requireCashSessionAccess} from '@/src/cash/cash-route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {context}=await requireCashSessionAccess(req,id);
    const body = await req.json();

    const result = await CashService.closeCashSession(id, {
      closedBy:context.userId,
      closingNotes: body.notes || body.closingNotes,
      latitude: body.latitude,
      longitude: body.longitude,
      closedClientAt: body.closedClientAt,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    const message=error.message||'No pudimos cerrar la sesión de caja.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}
