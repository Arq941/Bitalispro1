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
    const body = await req.json();

    const newMedia = await ClientService.replaceMedia(mediaId, body, userContext);
    return NextResponse.json({ success: true, media: newMedia }, { status: 201 });
  } catch (err: any) {
    const isForbidden = err.message?.includes('FORBIDDEN');
    return NextResponse.json(
      { success: false, error: err.message },
      { status: isForbidden ? 403 : 400 }
    );
  }
}
