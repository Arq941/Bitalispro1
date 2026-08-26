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
    const body = await req.json();

    const result = await SalesService.registerDownPayment(
      {
        saleId: id,
        ...body,
      },
      userContext
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al registrar el enganche' },
      { status: 400 }
    );
  }
}
