import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import {httpStatusForCashError,requireCashSessionAccess} from '@/src/cash/cash-route-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireCashSessionAccess(req,id);
    const reconciliation = await CashService.getReconciliation(id);

    return NextResponse.json({ success: true, data: reconciliation }, { status: 200 });
  } catch (error: any) {
    const message=error.message||'No pudimos consultar la conciliación.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}
