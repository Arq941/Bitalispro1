import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    const body = await req.json();
    if (!body.cashSessionId) return NextResponse.json({ error: 'cashSessionId is required' }, { status: 400 });
    const result = await CashService.closeCashSession(body.cashSessionId, {
      closedBy: user.userId,
      closingNotes: body.closingNotes,
      latitude: body.latitude,
      longitude: body.longitude,
      closedClientAt: body.closedClientAt,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const message = error?.message || 'Failed to close cash session';
    const status = /token|autentic|authorization|bearer/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
