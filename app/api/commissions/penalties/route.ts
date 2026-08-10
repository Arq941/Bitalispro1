import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET() {
  try {
    const prisma = PrismaService.getInstance();
    const penalties = await prisma.commissionPenalty.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: penalties.length,
      penalties,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener penalizaciones' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const body = await req.json();

    const result = await CommissionService.createPenalty({
      employeeId: body.employeeId,
      reason: body.reason,
      amount: body.amount,
      authorizedBy: userContext.userId || 'SUPERVISOR',
      periodId: body.periodId,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      penalty: result.penaltyRecord,
      commission: result.commission,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al aplicar penalización' },
      { status: 400 }
    );
  }
}
