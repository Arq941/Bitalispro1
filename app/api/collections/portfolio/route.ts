import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { SecurityService } from '@/src/server/auth/security.service';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED: Bearer token requerido.' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const verified = SecurityService.verifyAccessToken(token);
    if (!verified?.sub || !verified?.role) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED: Token inválido o expirado.' }, { status: 401 });
    }

    const prisma = PrismaService.getInstance();
    const where: any = {
      status: 'ACTIVE',
      saldoActual: { gt: 0 },
    };

    if (verified.role === 'COBRADOR') {
      where.client = { assignedCollectorId: verified.sub };
    }

    const credits = await prisma.credit.findMany({
      where,
      orderBy: [
        { proximaVisita: 'asc' },
        { updatedAt: 'asc' },
      ],
      include: {
        client: {
          select: {
            id: true,
            clientNumber: true,
            firstName: true,
            lastName: true,
            secondLastName: true,
            phone: true,
            latitude: true,
            longitude: true,
            riskLevel: true,
            assignedCollectorId: true,
          },
        },
        sale: {
          select: {
            id: true,
            saleNumber: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: credits.map((credit) => ({
        id: credit.id,
        saleId: credit.saleId,
        saleNumber: credit.sale?.saleNumber || null,
        clientId: credit.clientId,
        principalAmount: Number(credit.principalAmount),
        saldoActual: Number(credit.saldoActual),
        suggestedInstallment: Number(credit.suggestedInstallment),
        paymentFrequency: credit.paymentFrequency,
        proximaVisita: credit.proximaVisita,
        status: credit.status,
        client: credit.client,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error al obtener cartera de cobranza.' }, { status: 500 });
  }
}
