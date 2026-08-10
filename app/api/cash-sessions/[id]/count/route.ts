import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const countedBy = body.countedBy || body.userId || 'COLLECTOR';
    const denominations = body.denominations || body;

    const result = await CashService.createCashCount({
      cashSessionId: id,
      countedBy,
      denominations,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process cash count' }, { status: 400 });
  }
}
