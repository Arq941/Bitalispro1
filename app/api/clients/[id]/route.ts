import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);

    const client = await ClientService.getClientById(id, userContext);
    return NextResponse.json({ success: true, client });
  } catch (err: any) {
    const isForbidden = err.message?.includes('FORBIDDEN');
    return NextResponse.json(
      { success: false, error: err.message },
      { status: isForbidden ? 403 : 404 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);
    const body = await req.json();

    const client = await ClientService.updateClient(id, body, userContext);
    return NextResponse.json({ success: true, client });
  } catch (err: any) {
    const isForbidden = err.message?.includes('FORBIDDEN');
    return NextResponse.json(
      { success: false, error: err.message },
      { status: isForbidden ? 403 : 400 }
    );
  }
}
