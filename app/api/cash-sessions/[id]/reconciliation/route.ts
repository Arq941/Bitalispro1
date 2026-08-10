import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reconciliation = await CashService.getReconciliation(id);

    return NextResponse.json({ success: true, data: reconciliation }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch reconciliation' }, { status: 400 });
  }
}
