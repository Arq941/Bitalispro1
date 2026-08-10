import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await CashService.getSessionById(id);

    if (!session) {
      return NextResponse.json({ error: 'Cash session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: session }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch cash session' }, { status: 400 });
  }
}
