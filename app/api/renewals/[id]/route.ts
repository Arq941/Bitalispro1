import { NextRequest, NextResponse } from 'next/server';
import { RenewalService } from '@/src/renewals/renewals.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const renewal = await RenewalService.getRenewalById(id);
    if (!renewal) {
      return NextResponse.json({ success: false, error: 'Renovación no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: renewal });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
