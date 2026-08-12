import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = getSalesUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'cash.view');

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId') || searchParams.get('collectorId');
    const canInspectOthers = userContext.role === 'ADMIN' || userContext.role === 'SUPERVISORA';
    const userId = canInspectOthers && requestedUserId ? requestedUserId : userContext.userId;

    const session = await CashService.getCurrentSession(userId);

    if (!session) {
      return NextResponse.json({ success: true, data: null, message: 'No active cash session found' }, { status: 200 });
    }

    return NextResponse.json({ success: true, data: session }, { status: 200 });
  } catch (error: any) {
    const message = error?.message || 'No se pudo consultar la caja.';
    const status = message.includes('UNAUTHORIZED') ? 401 : message.includes('FORBIDDEN') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
