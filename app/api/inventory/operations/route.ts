import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function GET(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'inventory.view');
    const { searchParams } = new URL(req.url);
    const movements = await InventoryService.getKardex(searchParams.get('productId') || undefined, searchParams.get('warehouseId') || undefined);
    return NextResponse.json({ success: true, movements }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos consultar el kardex.');
    return NextResponse.json({ success: false, error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'inventory.manage');
    const body = await req.json();
    const common = { productId: String(body.productId || ''), warehouseId: String(body.warehouseId || ''), quantity: Number(body.quantity), reason: String(body.reason || '').trim(), userId: user.userId, idempotencyKey: req.headers.get('idempotency-key') || body.idempotencyKey };
    if (!common.productId || !common.warehouseId) throw new Error('Selecciona producto y almacén.');
    if (!Number.isInteger(common.quantity) || common.quantity <= 0) throw new Error('La cantidad debe ser un entero mayor a cero.');
    if (!common.reason) throw new Error('El motivo es obligatorio.');
    let result;
    if (body.operation === 'DAMAGE') result = await InventoryService.reportDamage(common);
    else if (body.operation === 'RETURN_IN') result = await InventoryService.returnInventory({ ...common, saleId: body.saleId || undefined });
    else if (body.operation === 'ADJUSTMENT_IN') result = await InventoryService.adjustStock({ warehouseId: common.warehouseId, productId: common.productId, quantityDelta: common.quantity, reason: common.reason, userId: common.userId, idempotencyKey: common.idempotencyKey || undefined });
    else if (body.operation === 'ADJUSTMENT_OUT') result = await InventoryService.adjustStock({ warehouseId: common.warehouseId, productId: common.productId, quantityDelta: -common.quantity, reason: common.reason, userId: common.userId, idempotencyKey: common.idempotencyKey || undefined });
    else if (body.operation === 'SUPPLIER_RETURN') result = await InventoryService.adjustStock({ warehouseId: common.warehouseId, productId: common.productId, quantityDelta: -common.quantity, reason: `Devolución a proveedor: ${common.reason}`, userId: common.userId, idempotencyKey: common.idempotencyKey || undefined });
    else throw new Error('Tipo de operación no permitido.');
    return NextResponse.json({ success: true, result }, { status: 201 });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos registrar el movimiento.');
    return NextResponse.json({ success: false, error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 400 });
  }
}
