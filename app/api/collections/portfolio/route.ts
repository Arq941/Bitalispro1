import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { SecurityService } from '@/src/server/auth/security.service';
import { PermissionService } from '@/src/server/auth/permission.service';

function mexicoTodayRange() {
  const now = new Date();
  const mexicoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const start = new Date(`${mexicoDate}T00:00:00-06:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, mexicoDate };
}

const riskWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

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

    await PermissionService.requirePermission(verified.sub, 'collections.view');

    const prisma = PrismaService.getInstance();
    const { start, end, mexicoDate } = mexicoTodayRange();
    const scope = req.nextUrl.searchParams.get('scope') === 'all' ? 'all' : 'daily';

    const baseWhere: any = {
      status: 'ACTIVE',
      saldoActual: { gt: 0 },
    };
    if (verified.role === 'COBRADOR') {
      baseWhere.client = { assignedCollectorId: verified.sub };
    }

    const credits = await prisma.credit.findMany({
      where: baseWhere,
      include: {
        client: {
          select: {
            id: true, clientNumber: true, firstName: true, lastName: true, secondLastName: true,
            phone: true, latitude: true, longitude: true, riskLevel: true,
            assignedCollectorId: true,
            profile: { select: { preferredCollectionDay: true } },
          },
        },
        sale: { select: { id: true, saleNumber: true } },
        reschedules: { orderBy: { createdAt: 'desc' }, take: 1 },
        schedules: {
          where: { status: { in: ['PENDING', 'PARTIAL'] } },
          orderBy: { scheduledDate: 'asc' },
          take: 1,
        },
      },
    });

    const weekday = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long' })
      .format(new Date())
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const mapped = credits.map((credit) => {
      const nextSchedule = credit.schedules?.[0]?.scheduledDate || null;
      const nextVisit = credit.proximaVisita || null;
      const latestReschedule = credit.reschedules?.[0]?.newDate || null;
      const preferredDay = credit.client.profile?.preferredCollectionDay?.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || null;

      const dueDates = [nextSchedule, nextVisit, latestReschedule].filter(Boolean) as Date[];
      const earliest = dueDates.length ? new Date(Math.min(...dueDates.map(d => new Date(d).getTime()))) : null;
      const overdue = earliest ? earliest < start : false;
      const dueToday = earliest ? earliest >= start && earliest < end : false;
      const preferredToday = preferredDay ? preferredDay.includes(weekday) : false;
      const risk = credit.client.riskLevel || 'LOW';

      let priorityScore = 0;
      if (overdue) priorityScore += 100;
      if (dueToday) priorityScore += 80;
      if (preferredToday) priorityScore += 40;
      priorityScore += (riskWeight[risk] || 1) * 10;
      if (credit.client.latitude != null && credit.client.longitude != null) priorityScore += 5;

      return {
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
        client: {
          ...credit.client,
          preferredCollectionDay: credit.client.profile?.preferredCollectionDay || null,
          profile: undefined,
        },
        collection: {
          overdue,
          dueToday,
          preferredToday,
          nextScheduledDate: nextSchedule,
          latestRescheduleDate: latestReschedule,
          priorityScore,
        },
      };
    });

    const sorted = [...mapped]
      .sort((a, b) => b.collection.priorityScore - a.collection.priorityScore || Number(b.saldoActual) - Number(a.saldoActual));
    const todays = sorted
      .filter(c => c.collection.overdue || c.collection.dueToday || c.collection.preferredToday);
    const data = scope === 'all' ? sorted : (todays.length ? todays : sorted);

    return NextResponse.json({
      success: true,
      date: mexicoDate,
      scope,
      mode: scope === 'all' ? 'FULL_PORTFOLIO' : todays.length ? 'DAILY_PRIORITY' : 'ACTIVE_FALLBACK',
      totalActive: mapped.length,
      totalToday: todays.length,
      data,
    });
  } catch (err: any) {
    const message = err?.message || 'Error al obtener cartera de cobranza.';
    const status = message.includes('FORBIDDEN') ? 403 : message.includes('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
