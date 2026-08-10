import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/src/procurement/procurement.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const role = String(userContext.role);
    if (!['SUPERVISORA', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Acceso denegado: Solo SUPERVISORA o ADMIN pueden aprobar órdenes de compra' }, { status: 403 });
    }

    const order = await ProcurementService.approveOrder(id, userContext.userId);
    return NextResponse.json({ success: true, data: order });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
