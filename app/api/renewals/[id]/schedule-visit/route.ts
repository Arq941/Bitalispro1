import { NextRequest, NextResponse } from 'next/server';
import { RenewalService } from '@/src/renewals/renewals.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const body = await req.json();
    if (!body.visitDate) {
      return NextResponse.json({ success: false, error: 'visitDate es obligatorio' }, { status: 400 });
    }
    const renewal = await RenewalService.scheduleVisit(id, body.visitDate, body.notes, userContext.userId);
    return NextResponse.json({ success: true, data: renewal });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
