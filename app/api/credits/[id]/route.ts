import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'collections.view');
    const { id } = await params;
    const credit = await SalesService.getCreditById(id);
    if (!credit) {
      return NextResponse.json({ error: 'Crédito no encontrado' }, { status: 404 });
    }
    if (user.role === 'COBRADOR' && credit.client?.assignedCollectorId !== user.userId) {
      return NextResponse.json({ error: 'FORBIDDEN: El crédito no pertenece a tu cartera.' }, { status: 403 });
    }
    return NextResponse.json(credit, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al consultar el crédito' },
      { status: String(err?.message||'').includes('UNAUTHORIZED') ? 401 : String(err?.message||'').includes('FORBIDDEN') ? 403 : 500 }
    );
  }
}
