import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const approvedBy = userContext.userId || 'SUPERVISOR_ADMIN';

    const period = await CommissionService.approvePeriod(id, approvedBy);

    return NextResponse.json({
      success: true,
      message: 'Periodo aprobado con éxito',
      period,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al aprobar el periodo' },
      { status: 400 }
    );
  }
}
