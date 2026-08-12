import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { SecurityService } from '@/src/server/auth/security.service';

type Point = {
  id: string;
  clientId: string;
  latitude: number;
  longitude: number;
  priorityScore: number;
  riskLevel: string;
  saldoActual: number;
  dueToday: boolean;
  overdue: boolean;
};

const riskWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const toRad = (v: number) => (v * Math.PI) / 180;
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function mexicoDayRange() {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const start = new Date(`${date}T00:00:00-06:00`);
  const end = new Date(start.getTime() + 86400000);
  return { date, start, end };
}

function buildStablePlan(points: Point[], origin: { lat: number; lng: number }) {
  const remaining = [...points];
  const ordered: Array<Point & { order: number; distanceFromPreviousKm: number; routeScore: number }> = [];
  let cursor = origin;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    let bestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const distance = distanceKm(cursor, { lat: item.latitude, lng: item.longitude });

      // La prioridad financiera manda, pero penalizamos trayectos largos.
      // Esto evita zig-zag sin sacrificar morosos/críticos importantes.
      const financial = item.priorityScore;
      const urgency = (item.overdue ? 35 : 0) + (item.dueToday ? 20 : 0) + (riskWeight[item.riskLevel] || 1) * 6;
      const distancePenalty = Math.min(distance, 30) * 4;
      const routeScore = financial + urgency - distancePenalty;

      if (routeScore > bestScore || (routeScore === bestScore && distance < bestDistance)) {
        bestScore = routeScore;
        bestDistance = distance;
        bestIndex = i;
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    ordered.push({ ...chosen, order: ordered.length + 1, distanceFromPreviousKm: bestDistance, routeScore: Math.round(bestScore * 100) / 100 });
    cursor = { lat: chosen.latitude, lng: chosen.longitude };
  }

  return ordered;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Bearer token requerido.' }, { status: 401 });
    }
    const verified = SecurityService.verifyAccessToken(authHeader.slice(7).trim());
    if (!verified?.sub || !verified?.role) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Token inválido o expirado.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'latitude y longitude son requeridos para planear la ruta.' }, { status: 400 });
    }

    const completedIds = Array.isArray(body.completedCreditIds) ? body.completedCreditIds.filter((v: unknown) => typeof v === 'string') : [];
    const prisma = PrismaService.getInstance();
    const { date, start, end } = mexicoDayRange();

    const where: any = { status: 'ACTIVE', saldoActual: { gt: 0 }, id: { notIn: completedIds } };
    if (verified.role === 'COBRADOR') where.client = { assignedCollectorId: verified.sub };

    const credits = await prisma.credit.findMany({
      where,
      include: {
        client: { select: { id: true, latitude: true, longitude: true, riskLevel: true, profile: { select: { preferredCollectionDay: true } } } },
        schedules: { where: { status: { in: ['PENDING', 'PARTIAL'] } }, orderBy: { scheduledDate: 'asc' }, take: 1 },
        reschedules: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const weekday = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long' })
      .format(new Date()).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const points: Point[] = credits.flatMap((credit) => {
      if (credit.client.latitude == null || credit.client.longitude == null) return [];
      const nextSchedule = credit.schedules?.[0]?.scheduledDate || null;
      const nextVisit = credit.proximaVisita || null;
      const latestReschedule = credit.reschedules?.[0]?.newDate || null;
      const dueDates = [nextSchedule, nextVisit, latestReschedule].filter(Boolean) as Date[];
      const earliest = dueDates.length ? new Date(Math.min(...dueDates.map(d => new Date(d).getTime()))) : null;
      const overdue = earliest ? earliest < start : false;
      const dueToday = earliest ? earliest >= start && earliest < end : false;
      const preferred = credit.client.profile?.preferredCollectionDay?.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
      const preferredToday = preferred.includes(weekday);
      const riskLevel = credit.client.riskLevel || 'LOW';
      let priorityScore = (riskWeight[riskLevel] || 1) * 10 + 5;
      if (overdue) priorityScore += 100;
      if (dueToday) priorityScore += 80;
      if (preferredToday) priorityScore += 40;
      return [{
        id: credit.id,
        clientId: credit.clientId,
        latitude: Number(credit.client.latitude),
        longitude: Number(credit.client.longitude),
        priorityScore,
        riskLevel,
        saldoActual: Number(credit.saldoActual),
        dueToday,
        overdue,
      }];
    });

    const todays = points.filter(p => p.overdue || p.dueToday || p.priorityScore >= 45);
    const candidates = todays.length ? todays : points;
    const plan = buildStablePlan(candidates, { lat: latitude, lng: longitude });

    return NextResponse.json({
      success: true,
      data: {
        date,
        generatedAt: new Date().toISOString(),
        origin: { latitude, longitude },
        completedCreditIds: completedIds,
        total: plan.length,
        orderedCreditIds: plan.map(p => p.id),
        stops: plan,
      },
    });
  } catch (error: any) {
    const message = error?.message || 'No fue posible generar el plan de ruta.';
    const status = /token|auth|bearer|unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
