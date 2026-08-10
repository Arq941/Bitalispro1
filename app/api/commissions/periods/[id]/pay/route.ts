import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const paidBy = userContext.userId || 'PAYROLL_ADMIN';

    const period = await CommissionService.payPeriod(id, paidBy);

    return NextResponse.json({
      success: true,
      message: 'Comisiones del periodo pagadas exitosamente',
      period,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al pagar el periodo' },
      { status: 400 }
    );
  }
}
