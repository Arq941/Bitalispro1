import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET() {
  try {
    const prisma = PrismaService.getInstance();
    const periods = await prisma.commissionPeriod.findMany({
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: periods.length,
      periods,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al listar periodos de comisión' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const body = await req.json();

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const periodName = body.periodName || `Semana ${startDate.toISOString().substring(0, 10)}`;

    const period = await CommissionService.createPeriod(startDate, endDate, periodName);

    return NextResponse.json({
      success: true,
      period,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al crear periodo de comisión' },
      { status: 400 }
    );
  }
}
