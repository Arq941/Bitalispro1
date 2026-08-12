import { NextRequest, NextResponse } from 'next/server';
import { SecurityService } from '@/src/server/auth/security.service';
import { InventoryService } from '@/src/inventory/inventory.service';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Bearer token requerido.' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const verified = SecurityService.verifyAccessToken(token);
    if (!verified || !verified.sub || !verified.role) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Token inválido o expirado.' }, { status: 401 });
    }

    if (!['ADMIN', 'SUPERVISORA', 'VENDEDORA'].includes(verified.role)) {
      return NextResponse.json({ error: 'FORBIDDEN: Rol no autorizado para entregar inventario.' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.warehouseId || !body.productId || !body.quantity) {
      return NextResponse.json({ error: 'warehouseId, productId y quantity son obligatorios.' }, { status: 400 });
    }

    const result = await InventoryService.deliverProduct({
      warehouseId: body.warehouseId,
      productId: body.productId,
      quantity: Number(body.quantity),
      reservationId: body.reservationId,
      saleId: body.saleId,
      userId: verified.sub,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err: any) {
    const message = err?.message || 'Error al entregar producto';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
