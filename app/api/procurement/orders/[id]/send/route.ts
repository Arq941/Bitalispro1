import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/src/procurement/procurement.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const order = await ProcurementService.getOrderById(id);
    if (!order) return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });

    order.status = 'ORDERED';
    order.updatedAt = new Date();
    ProcurementStore_ordersSet(id, order);

    return NextResponse.json({ success: true, data: order });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

function ProcurementStore_ordersSet(id: string, order: any) {
  const { ProcurementStore } = require('@/src/procurement/procurement.service');
  ProcurementStore.orders.set(id, order);
}
