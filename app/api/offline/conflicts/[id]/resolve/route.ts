import { NextRequest, NextResponse } from 'next/server';
import { ConflictResolverService } from '@/src/offline/conflict-resolver.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    const supervisorId = req.headers.get('x-user-id') || body.userId || 'SUPERVISORA-01';

    if (!body.resolution || !['FORCE_SYNC', 'REJECT', 'REVIEW'].includes(body.resolution)) {
      return NextResponse.json(
        { success: false, error: 'Resolución inválida. Debe ser FORCE_SYNC, REJECT o REVIEW.' },
        { status: 400 }
      );
    }

    const resolved = await ConflictResolverService.resolveConflict({
      conflictId: resolvedParams.id,
      supervisorId,
      resolution: body.resolution,
      notes: body.notes || body.resolutionNotes,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'NextJS-API',
    });

    return NextResponse.json({
      success: true,
      message: `Conflicto ${resolvedParams.id} resuelto como ${body.resolution}`,
      conflict: resolved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
