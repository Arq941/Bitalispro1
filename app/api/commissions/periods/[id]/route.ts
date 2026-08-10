import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prisma = PrismaService.getInstance();

    const period = await prisma.commissionPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return NextResponse.json({ success: false, error: 'Periodo no encontrado' }, { status: 404 });
    }

    const commissions = await prisma.commission.findMany({
      where: { periodId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      period,
      commissionsCount: commissions.length,
      commissions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener periodo' },
      { status: 400 }
    );
  }
}
