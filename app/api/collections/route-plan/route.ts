import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { SecurityService } from '@/src/server/auth/security.service';
import { PermissionService } from '@/src/server/auth/permission.service';

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
  preferredToday: boolean;
  suggestedInstallment: number;
  urgencyTier: number;
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

function routeDistance(points: Point[], origin: { lat: number; lng: number }) {
  let total = 0, cursor = origin;
  for (const point of points) { total += distanceKm(cursor, { lat: point.latitude, lng: point.longitude }); cursor = { lat: point.latitude, lng: point.longitude }; }
  return total;
}

function improveTwoOpt(input: Point[], origin: { lat: number; lng: number }) {
  const route = [...input];
  let improved = true, passes = 0;
  while (improved && passes++ < 4) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        if (route.slice(i, k + 1).some(point => point.urgencyTier !== route[i].urgencyTier)) continue;
        const before = routeDistance(route, origin);
        const candidate = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
        const after = routeDistance(candidate, origin);
        if (after + 0.01 < before) { route.splice(0, route.length, ...candidate); improved = true; }
      }
    }
  }
  return route;
}

function buildStablePlan(points: Point[], origin: { lat: number; lng: number }) {
  const remaining = [...points];
  const greedy: Point[] = [];
  let cursor = origin;
  while (remaining.length) {
    const activeTier = Math.min(...remaining.map(point => point.urgencyTier));
    const eligible = remaining.map((point, index) => ({ point, index })).filter(entry => entry.point.urgencyTier === activeTier);
    let best = eligible[0], bestScore = -Infinity;
    for (const entry of eligible) {
      const distance = distanceKm(cursor, { lat: entry.point.latitude, lng: entry.point.longitude });
      const score = entry.point.priorityScore - Math.min(distance, 30) * 5 + Math.min(entry.point.saldoActual / 100, 20);
      if (score > bestScore) { best = entry; bestScore = score; }
    }
    const [chosen] = remaining.splice(best.index, 1);
    greedy.push(chosen); cursor = { lat: chosen.latitude, lng: chosen.longitude };
  }
  const optimized = improveTwoOpt(greedy, origin);
  let previous = origin;
  return optimized.map((point, index) => {
    const leg = distanceKm(previous, { lat: point.latitude, lng: point.longitude });
    previous = { lat: point.latitude, lng: point.longitude };
    return { ...point, order: index + 1, distanceFromPreviousKm: Math.round(leg * 100) / 100, routeScore: point.priorityScore };
  });
}

async function handleRoutePlan(req: NextRequest, body: Record<string, unknown>) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Bearer token requerido.' }, { status: 401 });
    }
    const verified = SecurityService.verifyAccessToken(authHeader.slice(7).trim());
    if (!verified?.sub || !verified?.role) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Token inválido o expirado.' }, { status: 401 });
    }

    await PermissionService.requirePermission(verified.sub, 'route.view');

    const latitude = Number(body.latitude ?? body.lat);
    const longitude = Number(body.longitude ?? body.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'latitude y longitude son requeridos para planear la ruta.' }, { status: 400 });
    }

    const completedIds = Array.isArray(body.completedCreditIds) ? body.completedCreditIds.filter((v: unknown) => typeof v === 'string') : [];
    const requestedMaxStops = Number(body.maxStops || 45);
    const maxStops = Number.isInteger(requestedMaxStops) ? Math.min(60, Math.max(1, requestedMaxStops)) : 45;
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
        preferredToday,
        suggestedInstallment: Number(credit.suggestedInstallment || 0),
        urgencyTier: overdue && riskLevel === 'CRITICAL' ? 0 : overdue || dueToday ? 1 : preferredToday || ['CRITICAL','HIGH'].includes(riskLevel) ? 2 : 3,
      }];
    });

    const todays = points.filter(p => p.overdue || p.dueToday || p.priorityScore >= 45);
    const candidates = (todays.length ? todays : points)
      .sort((a, b) => a.urgencyTier - b.urgencyTier || b.priorityScore - a.priorityScore || b.saldoActual - a.saldoActual)
      .slice(0, maxStops);
    const plan = buildStablePlan(candidates, { lat: latitude, lng: longitude });
    const totalDistanceKm = Math.round(plan.reduce((sum, stop) => sum + stop.distanceFromPreviousKm, 0) * 100) / 100;
    const estimatedMinutes = Math.ceil((totalDistanceKm / 22) * 60 + plan.length * 8);
    const expectedCollection = Math.round(plan.reduce((sum, stop) => sum + Math.min(stop.suggestedInstallment, stop.saldoActual), 0) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        date,
        generatedAt: new Date().toISOString(),
        origin: { latitude, longitude },
        completedCreditIds: completedIds,
        total: plan.length,
        maxStops,
        totalDistanceKm,
        estimatedMinutes,
        expectedCollection,
        urgentStops: plan.filter(stop => stop.urgencyTier <= 1).length,
        optimization: 'URGENCY_NEAREST_NEIGHBOR_2OPT',
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handleRoutePlan(req, body);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const completedCreditIds = (params.get('completedCreditIds') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return handleRoutePlan(req, {
    latitude: params.get('latitude') ?? params.get('lat'),
    longitude: params.get('longitude') ?? params.get('lng'),
    completedCreditIds,
    maxStops: params.get('maxStops') || 45,
  });
}
