import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'inventory.manage');
    const body = await req.json();
    if (body.action !== 'CANCEL') throw new Error('Acción no permitida.');
    const order = await InventoryService.cancelProductOrder(id, user.userId, String(body.reason || '').trim());
    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos actualizar la orden.');
    return NextResponse.json({ success: false, error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 400 });
  }
}
