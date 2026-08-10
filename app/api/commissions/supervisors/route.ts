import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const supervisorId = req.nextUrl.searchParams.get('supervisorId') || userContext.userId || 'DEFAULT_SUPERVISOR';

    const dashboard = await CommissionService.getSupervisorDashboard(supervisorId);

    return NextResponse.json({
      success: true,
      supervisorId,
      dashboard,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener comisiones de supervisora' },
      { status: 400 }
    );
  }
}
