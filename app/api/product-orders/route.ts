import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

function statusOf(message: string) {
  return message.includes('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 400;
}

export async function GET(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'inventory.view');
    const orders = await InventoryService.getProductOrders();
    return NextResponse.json({ success: true, orders }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos consultar las órdenes.');
    return NextResponse.json({ success: false, error: message }, { status: statusOf(message) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'inventory.manage');
    const body = await req.json();
    if (!body.warehouseId) throw new Error('Selecciona un almacén.');
    if (!Array.isArray(body.items) || !body.items.length) throw new Error('Agrega al menos un producto.');
    for (const item of body.items) {
      if (!item.productId || !Number.isInteger(Number(item.quantityRequested)) || Number(item.quantityRequested) <= 0) throw new Error('Cada producto debe tener una cantidad entera mayor a cero.');
      if (!Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0) throw new Error('El costo unitario no es válido.');
    }
    const order = await InventoryService.createProductOrder({ ...body, userId: user.userId });
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos crear la orden.');
    return NextResponse.json({ success: false, error: message }, { status: statusOf(message) });
  }
}
