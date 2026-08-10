import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const role = req.nextUrl.searchParams.get('role') || userContext.role || 'ADMIN';
    const userId = req.nextUrl.searchParams.get('userId') || userContext.userId || 'DEFAULT_USER';

    let data;
    if (role === 'VENDEDORA') {
      data = await CommissionService.getSellerDashboard(userId);
    } else if (role === 'COBRADOR') {
      data = await CommissionService.getCollectorDashboard(userId);
    } else if (role === 'SUPERVISORA') {
      data = await CommissionService.getSupervisorDashboard(userId);
    } else {
      data = await CommissionService.getGlobalAdminDashboard();
    }

    return NextResponse.json({
      success: true,
      role,
      userId,
      dashboard: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener dashboard de comisiones' },
      { status: 400 }
    );
  }
}
