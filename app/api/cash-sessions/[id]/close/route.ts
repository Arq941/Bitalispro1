import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const closedBy = body.closedBy || body.userId || 'COLLECTOR';

    const result = await CashService.closeCashSession(id, {
      closedBy,
      closingNotes: body.notes || body.closingNotes,
      latitude: body.latitude,
      longitude: body.longitude,
      closedClientAt: body.closedClientAt,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to close cash session' }, { status: 400 });
  }
}
