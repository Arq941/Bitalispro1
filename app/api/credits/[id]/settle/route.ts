import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const body = await req.json().catch(() => ({}));

    const result = await SalesService.settleCredit(
      {
        creditId: id,
        ...body,
      },
      userContext
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error en liquidación anticipada' },
      { status: 400 }
    );
  }
}
