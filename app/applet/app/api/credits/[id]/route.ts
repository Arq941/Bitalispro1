import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const credit = await SalesService.getCreditById(id);
    if (!credit) {
      return NextResponse.json({ error: 'Crédito no encontrado' }, { status: 404 });
    }
    return NextResponse.json(credit, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al consultar el crédito' },
      { status: 500 }
    );
  }
}
