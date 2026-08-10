import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.userId && !body.collectorId) {
      return NextResponse.json({ error: 'userId or collectorId is required' }, { status: 400 });
    }

    if (body.openingFund === undefined || body.openingFund === null) {
      return NextResponse.json({ error: 'openingFund is required' }, { status: 400 });
    }

    if (!body.latitude || !body.longitude) {
      return NextResponse.json({ error: 'GPS coordinates (latitude, longitude) are mandatory for opening cash session' }, { status: 400 });
    }

    if (!body.deviceId) {
      return NextResponse.json({ error: 'deviceId is mandatory for opening cash session' }, { status: 400 });
    }

    if (!body.idempotencyKey) {
      return NextResponse.json({ error: 'idempotencyKey is required' }, { status: 400 });
    }

    const session = await CashService.openCashSession({
      userId: body.userId || body.collectorId,
      collectorId: body.collectorId || body.userId,
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
    return NextResponse.json({ error: error.message || 'Failed to open cash session' }, { status: 400 });
  }
}
