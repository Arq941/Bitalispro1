import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

function mexicoDayRange(date: string) {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const start = new Date(`${safe}T00:00:00-06:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, date: safe };
}

export async function GET(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'route.view');
    const prisma = PrismaService.getInstance();
    const { searchParams } = new URL(req.url);
    const { start, end, date } = mexicoDayRange(searchParams.get('date') || '');

    const [visits, payments] = await Promise.all([
      prisma.collectionVisit.findMany({
        where: {
          userId: user.userId,
          clientCapturedAt: { gte: start, lt: end },
        },
        select: {
          id: true,
          clientId: true,
          creditId: true,
          result: true,
          noPaymentReason: true,
          clientCapturedAt: true,
        },
        orderBy: { clientCapturedAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          collectorId: user.userId,
          clientCapturedAt: { gte: start, lt: end },
          verificationStatus: { in: ['VERIFIED', 'PENDING_VERIFICATION'] },
        },
        select: {
          id: true,
          creditId: true,
          amount: true,
          paymentMethod: true,
          clientCapturedAt: true,
        },
        orderBy: { clientCapturedAt: 'asc' },
      }),
    ]);

    const completedCreditIds = Array.from(new Set(visits.map(v => v.creditId).filter(Boolean))) as string[];
    const paidCreditIds = new Set(payments.map(p => p.creditId));
    const rescheduled = visits.filter(v => v.result === 'RESCHEDULED').length;
    const skipped = visits.filter(v => v.result === 'SKIPPED').length;
    const noPay = visits.filter(v => !['SUCCESS', 'RESCHEDULED', 'SKIPPED'].includes(v.result)).length;
    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        date,
        completedCreditIds,
        visits,
        payments,
        stats: {
          visited: visits.length,
          paid: paidCreditIds.size,
          noPay,
          rescheduled,
          skipped,
          totalCollected,
        },
      },
    });
  } catch (error: any) {
    const message = error?.message || 'No fue posible recuperar el avance de ruta.';
    const status = /token|autentic|authorization|bearer|unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
