import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';

function statusFromError(err: any, fallback: number) {
  const message = String(err?.message || '');
  if (message.includes('UNAUTHORIZED')) return 401;
  if (message.includes('FORBIDDEN')) return 403;
  return fallback;
}

export async function POST(req: NextRequest) {
  try {
    const userContext = getSalesUserContext(req);
    const body = await req.json();

    const result = await SalesService.createSale(body, userContext);

    // La supervisora también trabaja en campo y es autoridad de autorización.
    // Si su propia venta cae en una política que normalmente requiere revisión
    // (precio negociado o dos productos), se conserva todo el rastro de
    // AuthorizationRequest y se aprueba mediante el flujo oficial del backend.
    // La vendedora mantiene exactamente el flujo PENDING_AUTHORIZATION.
    if (
      result?.status === 'PENDING_AUTHORIZATION' &&
      (userContext.role === 'SUPERVISORA' || userContext.role === 'ADMIN')
    ) {
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
    getSalesUserContext(req);
    const sales = await SalesService.getSalesList();
    return NextResponse.json({ sales }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al obtener la lista de ventas' },
      { status: statusFromError(err, 500) }
    );
  }
}
