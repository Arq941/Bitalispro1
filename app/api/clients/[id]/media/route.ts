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
        { success: false, error: 'FORBIDDEN: Sin acceso a evidencias de este cliente.' },
        { status: 403 }
      );
    }

    const prisma = PrismaService.getInstance();
    const media = await prisma.clientMedia.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, media });
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

    const media = await ClientService.uploadMedia(id, body, userContext);
    return NextResponse.json({ success: true, media }, { status: 201 });
  } catch (err: any) {
    const isForbidden = err.message?.includes('FORBIDDEN');
    return NextResponse.json(
      { success: false, error: err.message },
      { status: isForbidden ? 403 : 400 }
    );
  }
}
