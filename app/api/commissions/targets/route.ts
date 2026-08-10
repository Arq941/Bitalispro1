import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET() {
  try {
    const prisma = PrismaService.getInstance();
    const targets = await prisma.commissionTarget.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: targets.length,
      targets,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener metas de comisiones' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const body = await req.json();

    const target = await CommissionService.upsertTarget({
      employeeId: body.employeeId,
      role: body.role,
      period: body.period || 'MONTHLY',
      targetAmount: body.targetAmount,
      bonusRate: body.bonusRate,
      bonusFixed: body.bonusFixed,
    });

    return NextResponse.json({
      success: true,
      target,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al guardar meta de comisiones' },
      { status: 400 }
    );
  }
}
