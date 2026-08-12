import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { PrismaService } from '@/src/database/prisma.service';

function errorResponse(err: any, fallbackStatus = 500) {
  const message = err?.message || 'Error interno.';
  if (message.includes('UNAUTHORIZED')) {
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
  if (message.includes('FORBIDDEN')) {
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
  return NextResponse.json({ success: false, error: message }, { status: fallbackStatus });
}

export async function GET(req: NextRequest) {
  try {
    const userContext = getClientUserContext(req);
    const searchParams = req.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const riskLevel = searchParams.get('riskLevel') || undefined;
    const customerType = searchParams.get('customerType') || undefined;
    const zoneId = searchParams.get('zoneId') || undefined;
    const assignedSellerId = searchParams.get('assignedSellerId') || undefined;
    const assignedCollectorId = searchParams.get('assignedCollectorId') || undefined;

    const result = await ClientService.getClients(
      {
        page,
        limit,
        search,
        status,
        riskLevel,
        customerType,
        zoneId,
        assignedSellerId,
        assignedCollectorId,
      },
      userContext
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return errorResponse(err, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userContext = getClientUserContext(req);
    const body = await req.json();

    if (!body?.firstName?.trim() || !body?.lastName?.trim() || !body?.phone?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nombre, apellido y teléfono son obligatorios.' },
        { status: 400 }
      );
    }

    const client = await ClientService.createClient(
      {
        ...body,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        secondLastName: body.secondLastName?.trim() || undefined,
        phone: body.phone.trim(),
        secondaryPhone: body.secondaryPhone?.trim() || undefined,
        email: body.email?.trim() || undefined,
        occupation: body.occupation?.trim() || undefined,
      },
      userContext
    );

    // ClientService conserva un fallback en memoria para pruebas. En producción
    // verificamos explícitamente que el alta haya quedado persistida en MySQL.
    const prisma = PrismaService.getInstance();
    let persisted = await prisma.client.findUnique({ where: { id: client.id } });

    if (!persisted) {
      // Reintento mínimo y seguro: evita que un fallo en timeline/auditoría o en
      // campos opcionales termine mostrando un cliente creado que solo existe
      // en memoria y desaparece al recargar la pantalla.
      persisted = await prisma.client.create({
        data: {
          id: client.id,
          clientNumber: client.clientNumber,
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          secondLastName: body.secondLastName?.trim() || null,
          phone: body.phone.trim(),
          secondaryPhone: body.secondaryPhone?.trim() || null,
          email: body.email?.trim() || null,
          occupation: body.occupation?.trim() || null,
          customerType: body.customerType || 'NEW',
          status: 'PROSPECT',
          riskLevel: 'LOW',
          latitude: typeof body.latitude === 'number' ? body.latitude : null,
          longitude: typeof body.longitude === 'number' ? body.longitude : null,
          locationCapturedAt: typeof body.latitude === 'number' ? new Date() : null,
          createdBy: userContext.userId,
          assignedSellerId: userContext.role === 'VENDEDORA' ? userContext.userId : null,
        },
      });
    }

    return NextResponse.json({ success: true, client: persisted }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/clients production error:', err);
    return errorResponse(err, 400);
  }
}
