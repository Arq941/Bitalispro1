import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const collectorId = req.nextUrl.searchParams.get('collectorId') || userContext.userId || 'DEFAULT_COLLECTOR';

    const dashboard = await CommissionService.getCollectorDashboard(collectorId);

    return NextResponse.json({
      success: true,
      collectorId,
      dashboard,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener comisiones de cobrador' },
      { status: 400 }
    );
  }
}
