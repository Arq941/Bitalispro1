import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/src/procurement/procurement.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const body = await req.json();

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: 'items es obligatorio para la recepción' }, { status: 400 });
    }

    const result = await ProcurementService.receiveOrder({
      orderId: id,
      warehouseId: body.warehouseId,
      receivedBy: userContext.userId,
      notes: body.notes,
      items: body.items,
    }, userContext.userId);

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
