import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';

function statusFromError(err: any, fallback: number): number {
  const message = String(err?.message || '');
  if (message.includes('UNAUTHORIZED')) return 401;
  if (message.includes('FORBIDDEN')) return 403;
  return fallback;
}

export async function GET(req: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);
    const client = await ClientService.getClientById(id, userContext);
    return NextResponse.json({ success: true, client });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message },{ status: statusFromError(err, 404) });
  }
}

export async function PATCH(req: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);
    if (!['ADMIN','SUPERVISORA'].includes(userContext.role)) {
      return NextResponse.json({ success:false, error:'La vendedora únicamente registra el alta inicial. Supervisión completa o modifica el expediente.' },{status:403});
    }
    const body = await req.json();
    const client = await ClientService.updateClient(id, body, userContext);
    return NextResponse.json({ success: true, client });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message },{ status: statusFromError(err, 400) });
  }
}
