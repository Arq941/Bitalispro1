import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'commissions.view');

    const canInspectOthers = userContext.role === 'ADMIN';
    const requestedRole = req.nextUrl.searchParams.get('role');
    const requestedUserId = req.nextUrl.searchParams.get('userId');
    const role = canInspectOthers && requestedRole ? requestedRole : userContext.role;
    const userId = canInspectOthers && requestedUserId ? requestedUserId : userContext.userId;

    let data;
    if (role === 'VENDEDORA') {
      data = await CommissionService.getSellerDashboard(userId);
    } else if (role === 'COBRADOR') {
      data = await CommissionService.getCollectorDashboard(userId);
    } else if (role === 'SUPERVISORA') {
      data = await CommissionService.getSupervisorDashboard(userId);
    } else {
      if (userContext.role !== 'ADMIN') throw new Error('FORBIDDEN: Panel global reservado a administración.');
      data = await CommissionService.getGlobalAdminDashboard();
    }

    return NextResponse.json({ success: true, role, userId, dashboard: data });
  } catch (error: any) {
    const message = error?.message || 'Error al obtener dashboard de comisiones';
    const status = message.includes('UNAUTHORIZED') ? 401 : message.includes('FORBIDDEN') ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
