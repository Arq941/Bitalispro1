import { NextRequest, NextResponse } from 'next/server';
import {httpStatusForCashError,requireCashSessionAccess} from '@/src/cash/cash-route-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {session} = await requireCashSessionAccess(req,id);

    return NextResponse.json({ success: true, data: session }, { status: 200 });
  } catch (error: any) {
    const message=error.message||'No pudimos consultar la sesión de caja.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}
