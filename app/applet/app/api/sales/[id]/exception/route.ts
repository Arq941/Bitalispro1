import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userContext = getSalesUserContext(req);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'APPROVE') {
      const result = await SalesService.approveDownPaymentException(id, userContext);
      return NextResponse.json(result, { status: 200 });
    } else {
      const result = await SalesService.requestDownPaymentException(
        {
          saleId: id,
          requestedAmount: body.requestedAmount || 0,
          reason: body.reason || 'Excepción solicitada por cliente recurrente',
        },
        userContext
      );
      return NextResponse.json(result, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error en excepción de enganche' },
      { status: 400 }
    );
  }
}
