import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

function statusFromError(err: any, fallback: number) {
  const message = String(err?.message || '');
  if (message.includes('UNAUTHORIZED')) return 401;
  if (message.includes('FORBIDDEN')) return 403;
  return fallback;
}

export async function POST(req: NextRequest) {
  try {
    const userContext = getSalesUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'sales.create');
    const body = await req.json();
    const headerKey = req.headers.get('idempotency-key')?.trim();
    const bodyKey = String(body?.idempotencyKey || '').trim();
    if (!headerKey || !bodyKey) throw new Error('Se requiere una clave de idempotencia para crear la venta.');
    if (headerKey !== bodyKey) throw new Error('La clave de idempotencia no coincide con la solicitud.');

    const result = await SalesService.createSale(body, userContext);

    if (
      result?.status === 'PENDING_AUTHORIZATION' &&
      (userContext.role === 'SUPERVISORA' || userContext.role === 'ADMIN')
    ) {
      await PermissionService.requirePermission(userContext.userId, 'sales.approve');
      await SalesService.approveSale(
        result.id,
        userContext,
        'Autorización en sitio por supervisión'
      );

      return NextResponse.json(
        {
          ...result,
          status: 'APPROVED',
          supervisorApprovedInField: true,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al crear la venta' },
      { status: statusFromError(err, 400) }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userContext = getSalesUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'sales.view');
    const sales = await SalesService.getSalesList();
    return NextResponse.json({ sales }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al obtener la lista de ventas' },
      { status: statusFromError(err, 500) }
    );
  }
}
