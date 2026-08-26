import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    const body = await req.json();

    if (body.openingFund === undefined || body.openingFund === null) {
      return NextResponse.json({ error: 'openingFund is required' }, { status: 400 });
    }
    if (body.latitude === undefined || body.longitude === undefined) {
      return NextResponse.json({ error: 'GPS coordinates (latitude, longitude) are mandatory for opening cash session' }, { status: 400 });
    }
    if (!body.deviceId) return NextResponse.json({ error: 'deviceId is mandatory for opening cash session' }, { status: 400 });
    if (!body.idempotencyKey) return NextResponse.json({ error: 'idempotencyKey is required' }, { status: 400 });

    const session = await CashService.openCashSession({
      userId: user.userId,
      collectorId: user.userId,
      openingFund: body.openingFund,
      openingLatitude: Number(body.latitude),
      openingLongitude: Number(body.longitude),
      deviceId: body.deviceId,
      openingNotes: body.notes || body.openingNotes,
      openedClientAt: body.openedClientAt,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error: any) {
    const message = error?.message || 'Failed to open cash session';
    const status = /token|autentic|authorization|bearer/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
