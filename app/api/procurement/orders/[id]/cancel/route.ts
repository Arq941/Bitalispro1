import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/src/procurement/procurement.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const body = await req.json().catch(() => ({}));

    const order = await ProcurementService.cancelOrder(id, body.reason, userContext.userId);
    return NextResponse.json({ success: true, data: order });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
