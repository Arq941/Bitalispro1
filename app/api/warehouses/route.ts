import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function GET(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'inventory.view');
    const warehouses = await InventoryService.getWarehouses();
    return NextResponse.json({ success: true, warehouses }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos consultar almacenes.');
    return NextResponse.json({ success: false, error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'inventory.manage');
    const warehouse = await InventoryService.createWarehouse(await req.json(), user.userId);
    return NextResponse.json({ success: true, warehouse }, { status: 201 });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos crear el almacén.');
    return NextResponse.json({ success: false, error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 400 });
  }
}
