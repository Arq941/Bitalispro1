import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'inventory.view');

    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId') || undefined;
    const inventory = await InventoryService.getInventoryList(warehouseId);
    return NextResponse.json({ success: true, inventory });
  } catch (err: any) {
    const message = err?.message || 'No pudimos cargar el inventario.';
    const status = message.startsWith('FORBIDDEN:') ? 403 : message.includes('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: status === 403 ? 'No tienes permiso para consultar inventario.' : message }, { status });
  }
}
