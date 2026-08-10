import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';

export async function GET(req: NextRequest) {
  try {
    const userContext = getClientUserContext(req);
    const searchParams = req.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const riskLevel = searchParams.get('riskLevel') || undefined;
    const customerType = searchParams.get('customerType') || undefined;
    const zoneId = searchParams.get('zoneId') || undefined;
    const assignedSellerId = searchParams.get('assignedSellerId') || undefined;
    const assignedCollectorId = searchParams.get('assignedCollectorId') || undefined;

    const result = await ClientService.getClients(
      {
        page,
        limit,
        search,
        status,
        riskLevel,
        customerType,
        zoneId,
        assignedSellerId,
        assignedCollectorId,
      },
      userContext
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    const isForbidden = err.message?.includes('FORBIDDEN');
    return NextResponse.json({ success: false, error: err.message }, { status: isForbidden ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userContext = getClientUserContext(req);
    const body = await req.json();

    const client = await ClientService.createClient(body, userContext);
    return NextResponse.json({ success: true, client }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
