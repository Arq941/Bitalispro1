import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);

    const hasAccess = await ClientService.checkClientAccess(id, userContext);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Sin acceso al perfil de este cliente.' },
        { status: 403 }
      );
    }

    const prisma = PrismaService.getInstance();
    const profile = await prisma.clientProfile.findUnique({
      where: { clientId: id },
    });

    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);
    const body = await req.json();

    const profile = await ClientService.upsertProfile(id, body, userContext);
    return NextResponse.json({ success: true, profile }, { status: 200 });
  } catch (err: any) {
    const isForbidden = err.message?.includes('FORBIDDEN');
    return NextResponse.json(
      { success: false, error: err.message },
      { status: isForbidden ? 403 : 400 }
    );
  }
}
