import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest) {
  try {
    const user = getSalesUserContext(req);
    const body = await req.json();
    if (!body.cashSessionId) return NextResponse.json({ error: 'cashSessionId is required' }, { status: 400 });
    const result = await CashService.createCashCount({
      cashSessionId: body.cashSessionId,
      countedBy: user.userId,
      denominations: body.denominations || {},
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const message = error?.message || 'Failed to count cash';
    const status = /token|autentic|authorization|bearer/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
