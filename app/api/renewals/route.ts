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
      supervisorId: userContext.role === 'SUPERVISORA' ? userContext.userId : undefined,
    });
    return NextResponse.json({ success: true, data: renewals });
  } catch (err: any) {
    const message = err?.message || 'No se pudieron cargar las renovaciones.';
    const httpStatus = message.includes('UNAUTHORIZED') ? 401 : message.includes('FORBIDDEN') ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status: httpStatus });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'renewals.manage');
    const body = await req.json();
    const id = String(body?.id || '');
    const action = String(body?.action || '').toUpperCase();
    if (!id) return NextResponse.json({ success: false, error: 'Falta la renovación.' }, { status: 400 });

    let data: any;
    if (action === 'CONTACT') {
      data = await RenewalService.contactClient(id, body?.notes ? String(body.notes) : undefined, userContext.userId);
    } else if (action === 'SCHEDULE_VISIT') {
      if (!body?.visitDate) return NextResponse.json({ success: false, error: 'Selecciona la fecha de visita.' }, { status: 400 });
      data = await RenewalService.scheduleVisit(id, String(body.visitDate), body?.notes ? String(body.notes) : undefined, userContext.userId);
    } else if (action === 'COMPLETE_VISIT') {
      data = await RenewalService.completeVisit(id, body?.notes ? String(body.notes) : undefined, userContext.userId);
    } else if (action === 'REJECT') {
      const reason = String(body?.reason || '').trim();
      if (!reason) return NextResponse.json({ success: false, error: 'Indica el motivo del rechazo.' }, { status: 400 });
      data = await RenewalService.rejectRenewal(id, reason, userContext.userId);
    } else {
      return NextResponse.json({ success: false, error: 'Acción de renovación no válida.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    const message = err?.message || 'No pudimos actualizar la renovación.';
    const httpStatus = message.includes('UNAUTHORIZED') ? 401 : message.includes('FORBIDDEN') ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status: httpStatus });
  }
}
