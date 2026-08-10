import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest) {
  try {
    const userContext = getSalesUserContext(req);
    const body = await req.json();

    const result = await SalesService.createSale(body, userContext);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al crear la venta' },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const sales = await SalesService.getSalesList();
    return NextResponse.json({ sales }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al obtener la lista de ventas' },
      { status: 500 }
    );
  }
}
