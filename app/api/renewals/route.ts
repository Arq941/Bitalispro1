import { NextRequest, NextResponse } from 'next/server';
import { RenewalService, RenewalEngine } from '@/src/renewals/renewals.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'renewals.view');
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    await RenewalEngine.evaluateAndGenerateCandidates();

    const renewals = await RenewalService.listRenewals({
      status,
      sellerId: userContext.role === 'VENDEDORA' ? userContext.userId : undefined,
    });
    return NextResponse.json({ success: true, data: renewals });
  } catch (err: any) {
    const message = err?.message || 'No se pudieron cargar las renovaciones.';
    const httpStatus = message.includes('UNAUTHORIZED') ? 401 : message.includes('FORBIDDEN') ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status: httpStatus });
  }
}
