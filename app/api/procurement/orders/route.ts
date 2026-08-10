import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/src/procurement/procurement.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    // ABAC Check: Cobrador cannot view global procurement orders
    if (userContext.role === 'COBRADOR') {
      return NextResponse.json({ success: false, error: 'Acceso denegado: El rol COBRADOR no tiene permiso para consultar órdenes de compra globales' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const warehouseId = searchParams.get('warehouseId') || undefined;

    const orders = await ProcurementService.listOrders({ status, warehouseId });
    return NextResponse.json({ success: true, data: orders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    if (userContext.role === 'COBRADOR') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.warehouseId || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: 'warehouseId e items son obligatorios' }, { status: 400 });
    }

    const order = await ProcurementService.createProductOrder(body, userContext.userId);
    return NextResponse.json({ success: true, data: order });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
