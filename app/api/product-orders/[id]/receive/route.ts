import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'inventory.manage');
    const body = await req.json();
    const order = await InventoryService.receiveProductOrder(id, Array.isArray(body.items) ? body.items : [], user.userId);
    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos registrar la recepción.');
    return NextResponse.json({ success: false, error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 400 });
  }
}
