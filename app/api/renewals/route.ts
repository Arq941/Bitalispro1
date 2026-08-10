import { NextRequest, NextResponse } from 'next/server';
import { RenewalService, RenewalEngine } from '@/src/renewals/renewals.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    // Disparar evaluación automática
    await RenewalEngine.evaluateAndGenerateCandidates();

    const renewals = await RenewalService.listRenewals({ status, sellerId: userContext.role === 'VENDEDORA' ? userContext.userId : undefined });
    return NextResponse.json({ success: true, data: renewals });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
