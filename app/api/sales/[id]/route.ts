import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sale = await SalesService.getSaleById(id);
    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }
    return NextResponse.json(sale, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al obtener la venta' },
      { status: 500 }
    );
  }
}
