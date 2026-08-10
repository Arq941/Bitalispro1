import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { SalesService } from '@/src/sales/sales.service';
import { CollectionService } from '@/src/collections/collection.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const credit = await SalesService.getCreditById(id);
    if (!credit) {
      return NextResponse.json({ success: false, error: 'Crédito no encontrado' }, { status: 404 });
    }
    const payments = await CollectionService.getPaymentsForCredit(id);
    return NextResponse.json({
      success: true,
      creditId: id,
      principalAmount: credit.principalAmount,
      saldoActual: credit.saldoActual,
      status: credit.status,
      proximaVisita: credit.proximaVisita,
      paymentsCount: payments.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener saldo del crédito' }, { status: 400 });
  }
}
