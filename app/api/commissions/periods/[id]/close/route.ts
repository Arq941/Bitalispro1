import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const closedBy = userContext.userId || 'SUPERVISOR_ADMIN';

    const period = await CommissionService.closePeriod(id, closedBy);

    return NextResponse.json({
      success: true,
      message: 'Periodo cerrado con éxito',
      period,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al cerrar el periodo' },
      { status: 400 }
    );
  }
}
