import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params;
    const userContext = getClientUserContext(req);

    if (userContext.role !== 'SUPERVISORA' && userContext.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Solo Supervisora o Administrador pueden revisar evidencias.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { status, comment } = body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Estado inválido. Debe ser APPROVED o REJECTED.' },
        { status: 400 }
      );
    }

    const media = await ClientService.reviewMedia(mediaId, status, comment, userContext);
    return NextResponse.json({ success: true, media });
  } catch (err: any) {
    const isForbidden = err.message?.includes('FORBIDDEN');
    return NextResponse.json(
      { success: false, error: err.message },
      { status: isForbidden ? 403 : 400 }
    );
  }
}
